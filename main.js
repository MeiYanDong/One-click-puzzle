// 模板选择区渲染
function renderTemplateList(templates) {
    const list = document.getElementById('template-list');
    list.innerHTML = '';
    templates.forEach((tpl, idx) => {
        const div = document.createElement('div');
        div.className = 'template-item';
        // 小SVG缩略图
        const w = 60, h = 96; // 缩略图竖屏比例
        let svg = `<svg width="${w}" height="${h}" viewBox="0 0 300 480" style="display:block;" xmlns="http://www.w3.org/2000/svg">`;
        tpl.cells.forEach(cell => {
            svg += `<polygon points="${cell.map(pt => pt.x*300+','+pt.y*480).join(' ')}" fill="#eaf3ff" stroke="#4f8cff" stroke-width="3" />`;
        });
        svg += '</svg>';
        div.innerHTML = svg + `<div style='text-align:center;font-size:13px;margin-top:4px;'>${tpl.name}</div>`;
        div.onclick = () => selectTemplate(idx);
        list.appendChild(div);
    });
}

let selectedTemplateIdx = null;
let uploadedImages = [];
// 每个格子的图片变换参数
let imageTransforms = [];
let editingCellIdx = null;

// 添加全局状态变量，用于追踪交换操作
let swapMode = false;  // 是否处于交换模式
let swapSourceIdx = null;  // 用于交换的源格子索引

// 添加旋转状态
let rotateState = {
    isRotating: false,
    startAngle: 0,
    currentAngle: 0
};

function selectTemplate(idx) {
    selectedTemplateIdx = idx;
    document.querySelectorAll('.template-item').forEach((el, i) => {
        el.classList.toggle('selected', i === idx);
    });
    const tip = document.getElementById('upload-tip');
    tip.innerText = `请上传${templates[idx].cells.length}张图片`;
    uploadedImages = [];
    imageTransforms = [];
    editingCellIdx = null;
    document.getElementById('image-upload').value = '';
    document.getElementById('preview-area').innerHTML = '';
}

const uploadInput = document.getElementById('image-upload');
uploadInput.addEventListener('change', function(e) {
    const files = Array.from(e.target.files);
    if (selectedTemplateIdx === null) {
        alert('请先选择模板');
        return;
    }
    const needCount = templates[selectedTemplateIdx].cells.length;
    if (files.length !== needCount) {
        alert(`请上传${needCount}张图片`);
        return;
    }
    uploadedImages = [];
    imageTransforms = [];
    let loaded = 0;
    files.forEach((file, i) => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            uploadedImages[i] = evt.target.result;
            // 每张图片初始变换参数
            imageTransforms[i] = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
            loaded++;
            if (loaded === needCount) {
                editingCellIdx = 0; // 默认选中第一个格子
                renderPreview();
            }
        };
        reader.readAsDataURL(file);
    });
});

// 全局拖拽和缩放状态
let dragState = {
    isDragging: false,
    startX: 0,
    startY: 0,
    lastOffsetX: 0,
    lastOffsetY: 0
};

// 重构: 纯净的渲染函数，不处理任何事件绑定
function renderPreview() {
    console.log("渲染预览, 当前编辑格子:", editingCellIdx);
    const area = document.getElementById('preview-area');
    area.innerHTML = '';
    
    if (selectedTemplateIdx === null || uploadedImages.length === 0) {
        area.innerHTML = '<p>请先选择模板并上传图片</p>';
        return;
    }
    
    // 保证editingCellIdx始终有效
    if (editingCellIdx === null || editingCellIdx < 0 || editingCellIdx >= uploadedImages.length) {
        editingCellIdx = 0;
    }
    
    const tpl = templates[selectedTemplateIdx];
    
    // 添加内边距，防止格子贴边
    const padding = 10;  // 内边距像素
    const sizeW = 300, sizeH = 480;
    const innerWidth = sizeW - padding * 2;
    const innerHeight = sizeH - padding * 2;
    
    // 创建整体布局容器（grid布局）
    const mainContainer = document.createElement('div');
    mainContainer.style.display = 'grid';
    mainContainer.style.gridTemplateColumns = 'auto minmax(180px, 220px)';
    mainContainer.style.gap = '30px';
    mainContainer.style.justifyContent = 'center';
    mainContainer.style.width = '100%';
    mainContainer.style.maxWidth = '100%';
    
    // 创建渲染主区域
    const renderArea = document.createElement('div');
    renderArea.className = 'render-container';
    renderArea.style.position = 'relative';
    renderArea.style.width = '300px';
    renderArea.style.maxWidth = '100%';
    renderArea.style.margin = '0 auto';
    renderArea.style.gridColumn = '1';
    
    // 1. SVG显示层 - 只负责显示，不处理事件
    let svg = `<svg id="preview-svg" width="100%" viewBox="0 0 ${sizeW} ${sizeH}" style="display:block;background-color:white;box-shadow:0 2px 8px rgba(0,0,0,0.15);" xmlns="http://www.w3.org/2000/svg">`;
    
    // 定义裁剪区（确保图片不会超出格子）
    svg += '<defs>';
    tpl.cells.forEach((cell, i) => {
        // 计算格子在留有内边距的区域内的坐标
        const scaledCell = cell.map(pt => ({
            x: padding + pt.x * innerWidth,
            y: padding + pt.y * innerHeight
        }));
        const points = scaledCell.map(pt => `${pt.x},${pt.y}`).join(' ');
        svg += `<clipPath id="cell${i}"><polygon points="${points}" /></clipPath>`;
    });
    svg += '</defs>';
    
    // 绘制图片和格子边框（使用裁剪确保不超出边界）
    tpl.cells.forEach((cell, i) => {
        const t = imageTransforms[i] || { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
        
        // 计算格子在留有内边距的区域内的坐标
        const scaledCell = cell.map(pt => ({
            x: padding + pt.x * innerWidth,
            y: padding + pt.y * innerHeight
        }));
        
        // 计算格子包围盒
        const xs = scaledCell.map(pt => pt.x);
        const ys = scaledCell.map(pt => pt.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        const maxX = Math.max(...xs);
        const maxY = Math.max(...ys);
        const centerX = (minX + maxX) / 2;
        const centerY = (minY + maxY) / 2;
        const width = maxX - minX;
        const height = maxY - minY;
        
        // 绘制格子区域（淡灰色背景）
        const points = scaledCell.map(pt => `${pt.x},${pt.y}`).join(' ');
        svg += `<polygon points="${points}" fill="#f8f8f8" />`;
        
        // 绘制图片（使用裁剪，确保不会超出格子）
        svg += `<g clip-path="url(#cell${i})">
            <image 
                href="${uploadedImages[i]}" 
                x="${centerX - width/2*t.scale + t.offsetX}"
                y="${centerY - height/2*t.scale + t.offsetY}"
                width="${width * t.scale}"
                height="${height * t.scale}"
                preserveAspectRatio="xMidYMid meet"
                transform="rotate(${t.rotation} ${centerX + t.offsetX} ${centerY + t.offsetY})"
            />
        </g>`;
        
        // 格子边框
        svg += `<polygon points="${points}" fill="none" 
                 stroke="${editingCellIdx===i?'#ff9800':'#000000'}" 
                 stroke-width="${editingCellIdx===i?'6':'3'}" />`;
    });
    
    svg += '</svg>';
    renderArea.innerHTML = svg;
    
    // 添加预览区标题
    const previewTitle = document.createElement('h3');
    previewTitle.textContent = '拼图预览区';
    previewTitle.style.margin = '0 0 10px 0';
    previewTitle.style.fontSize = '16px';
    previewTitle.style.textAlign = 'center';
    previewTitle.style.color = '#333';
    
    // 创建预览区容器
    const previewContainer = document.createElement('div');
    previewContainer.style.display = 'flex';
    previewContainer.style.flexDirection = 'column';
    previewContainer.style.alignItems = 'center';
    previewContainer.style.padding = '15px';
    previewContainer.style.border = '1px solid #e0e0e0';
    previewContainer.style.borderRadius = '8px';
    previewContainer.style.backgroundColor = '#f9f9f9';
    previewContainer.appendChild(previewTitle);
    previewContainer.appendChild(renderArea);
    
    // 替换图片按钮区域（完全独立的控制区）
    const buttonArea = document.createElement('div');
    buttonArea.className = 'control-panel';
    buttonArea.style.display = 'flex';
    buttonArea.style.flexDirection = 'column';
    buttonArea.style.gap = '10px';
    buttonArea.style.padding = '15px';
    buttonArea.style.border = '1px solid #e0e0e0';
    buttonArea.style.borderRadius = '8px';
    buttonArea.style.backgroundColor = '#f9f9f9';
    buttonArea.style.gridColumn = '2';
    buttonArea.style.alignSelf = 'start';
    buttonArea.style.height = '100%';
    buttonArea.style.boxSizing = 'border-box';
    
    const buttonTitle = document.createElement('h3');
    buttonTitle.textContent = '操作控制区';
    buttonTitle.style.margin = '0 0 10px 0';
    buttonTitle.style.fontSize = '16px';
    buttonTitle.style.textAlign = 'center';
    buttonTitle.style.color = '#333';
    buttonArea.appendChild(buttonTitle);
    
    // 当前状态显示
    const statusInfo = document.createElement('div');
    if (swapMode) {
        statusInfo.textContent = `交换模式: 请选择第二个格子`;
        statusInfo.style.backgroundColor = '#4285f4';
    } else {
        statusInfo.textContent = `当前编辑: 格子 ${editingCellIdx + 1}`;
        statusInfo.style.backgroundColor = '#ff9800';
    }
    statusInfo.style.fontSize = '14px';
    statusInfo.style.marginBottom = '15px';
    statusInfo.style.padding = '8px';
    statusInfo.style.color = 'white';
    statusInfo.style.borderRadius = '4px';
    statusInfo.style.textAlign = 'center';
    buttonArea.appendChild(statusInfo);
    
    // 添加模式切换分组
    const modeGroup = document.createElement('div');
    modeGroup.style.display = 'flex';
    modeGroup.style.flexDirection = 'column';
    modeGroup.style.gap = '5px';
    modeGroup.style.marginBottom = '15px';
    modeGroup.style.padding = '10px';
    modeGroup.style.border = '1px solid #e0e0e0';
    modeGroup.style.borderRadius = '4px';
    modeGroup.style.backgroundColor = '#f9f9f9';
    
    const modeTitle = document.createElement('div');
    modeTitle.textContent = '编辑模式';
    modeTitle.style.fontWeight = 'bold';
    modeTitle.style.marginBottom = '5px';
    modeTitle.style.fontSize = '14px';
    modeGroup.appendChild(modeTitle);
    
    // 交换模式按钮
    const swapButton = document.createElement('button');
    swapButton.textContent = swapMode ? '取消交换' : '交换图片模式';
    swapButton.style.padding = '8px 12px';
    swapButton.style.backgroundColor = swapMode ? '#f44336' : '#4285f4';
    swapButton.style.color = 'white';
    swapButton.style.border = 'none';
    swapButton.style.borderRadius = '4px';
    swapButton.style.cursor = 'pointer';
    
    swapButton.addEventListener('click', function() {
        swapMode = !swapMode;
        swapSourceIdx = swapMode ? editingCellIdx : null;
        renderPreview();
    });
    
    modeGroup.appendChild(swapButton);
    
    // 重置当前格子按钮
    const resetBtn = document.createElement('button');
    resetBtn.textContent = `重置当前格子`;
    resetBtn.style.padding = '8px 12px';
    resetBtn.style.backgroundColor = '#4f8cff';
    resetBtn.style.color = 'white';
    resetBtn.style.border = 'none';
    resetBtn.style.borderRadius = '4px';
    resetBtn.style.cursor = 'pointer';
    
    resetBtn.addEventListener('click', function() {
        if (editingCellIdx !== null) {
            imageTransforms[editingCellIdx] = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
            renderPreview();
        }
    });
    
    modeGroup.appendChild(resetBtn);
    buttonArea.appendChild(modeGroup);
    
    // 添加旋转控制分组
    const rotateGroup = document.createElement('div');
    rotateGroup.style.display = 'flex';
    rotateGroup.style.flexDirection = 'column';
    rotateGroup.style.gap = '5px';
    rotateGroup.style.marginBottom = '15px';
    rotateGroup.style.padding = '10px';
    rotateGroup.style.border = '1px solid #e0e0e0';
    rotateGroup.style.borderRadius = '4px';
    rotateGroup.style.backgroundColor = '#f9f9f9';
    
    const rotateTitle = document.createElement('div');
    rotateTitle.textContent = '图片旋转';
    rotateTitle.style.fontWeight = 'bold';
    rotateTitle.style.marginBottom = '5px';
    rotateTitle.style.fontSize = '14px';
    rotateGroup.appendChild(rotateTitle);
    
    // 显示当前旋转角度
    const currentRotation = editingCellIdx !== null ? 
        (imageTransforms[editingCellIdx].rotation || 0).toFixed(1) : 0;
    
    const rotationDisplay = document.createElement('div');
    rotationDisplay.textContent = `当前角度: ${currentRotation}°`;
    rotationDisplay.style.textAlign = 'center';
    rotationDisplay.style.marginBottom = '8px';
    rotationDisplay.style.fontSize = '14px';
    rotationDisplay.style.fontWeight = 'bold';
    rotationDisplay.style.color = '#555';
    rotateGroup.appendChild(rotationDisplay);
    
    // 提示信息
    const rotateHint = document.createElement('div');
    rotateHint.textContent = `拖动图片上方的旋转控制点可自由旋转图片`;
    rotateHint.style.textAlign = 'center';
    rotateHint.style.fontSize = '12px';
    rotateHint.style.marginBottom = '8px';
    rotateHint.style.color = '#666';
    rotateHint.style.fontStyle = 'italic';
    rotateGroup.appendChild(rotateHint);
    
    // 旋转按钮容器（水平排列）
    const rotateButtonsContainer = document.createElement('div');
    rotateButtonsContainer.style.display = 'flex';
    rotateButtonsContainer.style.justifyContent = 'space-between';
    rotateButtonsContainer.style.gap = '10px';
    
    // 逆时针旋转按钮
    const rotateLeftBtn = document.createElement('button');
    rotateLeftBtn.textContent = '↺ -15°';
    rotateLeftBtn.style.flex = '1';
    rotateLeftBtn.style.padding = '8px 5px';
    rotateLeftBtn.style.backgroundColor = '#4f8cff';
    rotateLeftBtn.style.color = 'white';
    rotateLeftBtn.style.border = 'none';
    rotateLeftBtn.style.borderRadius = '4px';
    rotateLeftBtn.style.cursor = 'pointer';
    
    rotateLeftBtn.addEventListener('click', function() {
        if (editingCellIdx !== null && !swapMode) {
            let t = imageTransforms[editingCellIdx];
            t.rotation = (t.rotation - 15) % 360;
            renderPreview();
        }
    });
    
    // 顺时针旋转按钮
    const rotateRightBtn = document.createElement('button');
    rotateRightBtn.textContent = '+15° ↻';
    rotateRightBtn.style.flex = '1';
    rotateRightBtn.style.padding = '8px 5px';
    rotateRightBtn.style.backgroundColor = '#4f8cff';
    rotateRightBtn.style.color = 'white';
    rotateRightBtn.style.border = 'none';
    rotateRightBtn.style.borderRadius = '4px';
    rotateRightBtn.style.cursor = 'pointer';
    
    rotateRightBtn.addEventListener('click', function() {
        if (editingCellIdx !== null && !swapMode) {
            let t = imageTransforms[editingCellIdx];
            t.rotation = (t.rotation + 15) % 360;
            renderPreview();
        }
    });
    
    rotateButtonsContainer.appendChild(rotateLeftBtn);
    rotateButtonsContainer.appendChild(rotateRightBtn);
    rotateGroup.appendChild(rotateButtonsContainer);
    
    // 直接输入角度的控制
    const rotateInputContainer = document.createElement('div');
    rotateInputContainer.style.display = 'flex';
    rotateInputContainer.style.alignItems = 'center';
    rotateInputContainer.style.marginTop = '8px';
    
    const rotateLabel = document.createElement('span');
    rotateLabel.textContent = '精确角度:';
    rotateLabel.style.marginRight = '8px';
    rotateLabel.style.fontSize = '14px';
    
    const rotateInput = document.createElement('input');
    rotateInput.type = 'number';
    rotateInput.min = '0';
    rotateInput.max = '359';
    rotateInput.step = '1';
    rotateInput.value = currentRotation;
    rotateInput.style.width = '60px';
    rotateInput.style.padding = '5px';
    rotateInput.style.border = '1px solid #ccc';
    rotateInput.style.borderRadius = '4px';
    
    const rotateApplyBtn = document.createElement('button');
    rotateApplyBtn.textContent = '应用';
    rotateApplyBtn.style.marginLeft = '8px';
    rotateApplyBtn.style.padding = '5px 10px';
    rotateApplyBtn.style.backgroundColor = '#4f8cff';
    rotateApplyBtn.style.color = 'white';
    rotateApplyBtn.style.border = 'none';
    rotateApplyBtn.style.borderRadius = '4px';
    rotateApplyBtn.style.cursor = 'pointer';
    
    rotateApplyBtn.addEventListener('click', function() {
        if (editingCellIdx !== null && !swapMode) {
            const angle = parseFloat(rotateInput.value) || 0;
            // 限制在0-360范围内
            imageTransforms[editingCellIdx].rotation = angle % 360;
            renderPreview();
        }
    });
    
    rotateInputContainer.appendChild(rotateLabel);
    rotateInputContainer.appendChild(rotateInput);
    rotateInputContainer.appendChild(rotateApplyBtn);
    rotateGroup.appendChild(rotateInputContainer);
    
    buttonArea.appendChild(rotateGroup);
    
    // 格子操作分组
    const cellGroup = document.createElement('div');
    cellGroup.style.display = 'flex';
    cellGroup.style.flexDirection = 'column';
    cellGroup.style.gap = '5px';
    cellGroup.style.marginBottom = '15px';
    cellGroup.style.padding = '10px';
    cellGroup.style.border = '1px solid #e0e0e0';
    cellGroup.style.borderRadius = '4px';
    cellGroup.style.backgroundColor = '#f9f9f9';
    
    const cellTitle = document.createElement('div');
    cellTitle.textContent = '格子选择';
    cellTitle.style.fontWeight = 'bold';
    cellTitle.style.marginBottom = '5px';
    cellTitle.style.fontSize = '14px';
    cellGroup.appendChild(cellTitle);
    
    // 为每个格子创建按钮
    tpl.cells.forEach((cell, i) => {
        const btn = document.createElement('button');
        
        // 设置按钮文字和样式（根据当前模式）
        if (swapMode) {
            if (i === swapSourceIdx) {
                btn.textContent = `格子 ${i+1} (交换源)`;
                btn.style.backgroundColor = '#4285f4';
                btn.style.color = 'white';
            } else {
                btn.textContent = `选择格子 ${i+1} 交换`;
                btn.style.backgroundColor = '#f0f0f0';
            }
        } else {
            // 正常编辑模式
            if (i === editingCellIdx) {
                btn.textContent = `格子 ${i+1} (当前)`;
                btn.style.backgroundColor = '#ff9800';
                btn.style.color = 'white';
            } else {
                btn.textContent = `选择格子 ${i+1}`;
                btn.style.backgroundColor = '#f0f0f0';
            }
        }
        
        btn.style.padding = '8px 12px';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.cursor = 'pointer';
        btn.style.marginBottom = '5px';
        
        // 点击按钮行为（根据当前模式）
        btn.addEventListener('click', function() {
            if (swapMode) {
                if (i !== swapSourceIdx) {
                    // 执行交换
                    const tempImage = uploadedImages[swapSourceIdx];
                    const tempTransform = imageTransforms[swapSourceIdx];
                    
                    uploadedImages[swapSourceIdx] = uploadedImages[i];
                    imageTransforms[swapSourceIdx] = imageTransforms[i];
                    
                    uploadedImages[i] = tempImage;
                    imageTransforms[i] = tempTransform;
                    
                    // 退出交换模式
                    swapMode = false;
                    swapSourceIdx = null;
                    editingCellIdx = i;  // 交换后选中目标格子
                }
            } else {
                // 正常编辑模式，选中格子
                editingCellIdx = i;
            }
            renderPreview();
        });
        
        cellGroup.appendChild(btn);
    });
    
    buttonArea.appendChild(cellGroup);
    
    // 单格子替换分组
    const replaceGroup = document.createElement('div');
    replaceGroup.style.display = 'flex';
    replaceGroup.style.flexDirection = 'column';
    replaceGroup.style.gap = '5px';
    replaceGroup.style.padding = '10px';
    replaceGroup.style.border = '1px solid #e0e0e0';
    replaceGroup.style.borderRadius = '4px';
    replaceGroup.style.backgroundColor = '#f9f9f9';
    
    const replaceTitle = document.createElement('div');
    replaceTitle.textContent = '图片替换';
    replaceTitle.style.fontWeight = 'bold';
    replaceTitle.style.marginBottom = '5px';
    replaceTitle.style.fontSize = '14px';
    replaceGroup.appendChild(replaceTitle);
    
    // 上传新图片替换当前格子
    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = `上传新图替换`;
    uploadBtn.style.padding = '8px 12px';
    uploadBtn.style.backgroundColor = '#4caf50';
    uploadBtn.style.color = 'white';
    uploadBtn.style.border = 'none';
    uploadBtn.style.borderRadius = '4px';
    uploadBtn.style.cursor = 'pointer';
    
    uploadBtn.addEventListener('click', function() {
        if (editingCellIdx === null) return;
        
        // 创建一个隐藏的文件上传输入
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';
        
        // 监听文件选择
        fileInput.addEventListener('change', function(e) {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = function(evt) {
                    // 替换当前格子的图片
                    uploadedImages[editingCellIdx] = evt.target.result;
                    // 重置变换参数
                    imageTransforms[editingCellIdx] = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
                    renderPreview();
                };
                reader.readAsDataURL(e.target.files[0]);
            }
        });
        
        // 触发文件选择
        document.body.appendChild(fileInput);
        fileInput.click();
        document.body.removeChild(fileInput);
    });
    
    replaceGroup.appendChild(uploadBtn);
    buttonArea.appendChild(replaceGroup);
    
    // 添加到主容器
    mainContainer.appendChild(previewContainer);
    mainContainer.appendChild(buttonArea);
    
    // 将主容器添加到页面
    area.appendChild(mainContainer);
    
    // 设置SVG尺寸
    const svgEl = document.getElementById('preview-svg');
    const svgRect = svgEl.getBoundingClientRect();
    
    // 交互层（叠在SVG上）
    const interactionLayer = document.createElement('div');
    interactionLayer.className = 'interaction-layer';
    interactionLayer.style.position = 'absolute';
    interactionLayer.style.left = '0';
    interactionLayer.style.top = '0';
    interactionLayer.style.width = '100%';
    interactionLayer.style.height = '100%';
    interactionLayer.style.zIndex = '10';
    
    // 添加格子点击区
    let currentCellData = null; // 保存当前编辑格子的数据
    
    tpl.cells.forEach((cell, i) => {
        const scaledCell = cell.map(pt => ({
            x: (padding + pt.x * innerWidth) / sizeW,
            y: (padding + pt.y * innerHeight) / sizeH
        }));
        
        // 如果是当前编辑的格子，保存其数据供后续使用
        if (i === editingCellIdx) {
            // 计算格子在留有内边距的区域内的坐标
            const absoluteScaledCell = cell.map(pt => ({
                x: padding + pt.x * innerWidth,
                y: padding + pt.y * innerHeight
            }));
            
            // 计算格子包围盒
            const xs = absoluteScaledCell.map(pt => pt.x);
            const ys = absoluteScaledCell.map(pt => pt.y);
            const minX = Math.min(...xs);
            const minY = Math.min(...ys);
            const maxX = Math.max(...xs);
            const maxY = Math.max(...ys);
            const centerX = (minX + maxX) / 2;
            const centerY = (minY + maxY) / 2;
            const width = maxX - minX;
            const height = maxY - minY;
            
            currentCellData = {
                center: { x: centerX, y: centerY },
                width: width,
                height: height,
                points: absoluteScaledCell
            };
        }
        
        const polygonArea = document.createElement('div');
        polygonArea.className = 'cell-selector';
        polygonArea.dataset.idx = i;
        polygonArea.style.position = 'absolute';
        polygonArea.style.left = '0';
        polygonArea.style.top = '0';
        polygonArea.style.width = '100%';
        polygonArea.style.height = '100%';
        polygonArea.style.zIndex = '1';
        polygonArea.style.cursor = 'pointer';
        
        // 用SVG path作为点击区
        const points = scaledCell.map(pt => `${pt.x*100}% ${pt.y*100}%`).join(',');
        polygonArea.style.clipPath = `polygon(${points})`;
        
        // 点击格子行为根据当前模式变化
        polygonArea.addEventListener('click', function(e) {
            if (swapMode) {
                // 交换模式
                if (i !== swapSourceIdx) {
                    // 执行交换
                    const tempImage = uploadedImages[swapSourceIdx];
                    const tempTransform = imageTransforms[swapSourceIdx];
                    
                    uploadedImages[swapSourceIdx] = uploadedImages[i];
                    imageTransforms[swapSourceIdx] = imageTransforms[i];
                    
                    uploadedImages[i] = tempImage;
                    imageTransforms[i] = tempTransform;
                    
                    // 退出交换模式
                    swapMode = false;
                    swapSourceIdx = null;
                    editingCellIdx = i;  // 交换后选中目标格子
                    renderPreview();
                }
            } else {
                // 正常编辑模式
                if (i !== editingCellIdx) {
                    editingCellIdx = i;
                    renderPreview();
                }
            }
            e.stopPropagation();
        });
        
        // 双击重置变换
        polygonArea.addEventListener('dblclick', function(e) {
            if (!swapMode && i === editingCellIdx) {
                console.log("双击重置格子:", i);
                imageTransforms[i] = { scale: 1, offsetX: 0, offsetY: 0, rotation: 0 };
                renderPreview();
                e.stopPropagation();
            }
        });
        
        interactionLayer.appendChild(polygonArea);
    });
    
    // 如果有选中的格子，添加旋转控制点
    if (currentCellData && !swapMode) {
        const center = currentCellData.center;
        const svgRect = svgEl.getBoundingClientRect();
        const scaleRatio = svgRect.width / sizeW; // SVG缩放比例
        
        // 旋转控制点样式和位置
        const rotateHandleSize = 20;
        const distanceFromBorder = 30; // 控制点到格子边缘的距离
        
        // 计算旋转控制点位置（放在格子上方的中心位置）
        const handleTop = Math.max(10, (center.y - currentCellData.height/2 - distanceFromBorder) * scaleRatio);
        const handleLeft = (center.x) * scaleRatio - rotateHandleSize/2;
        
        // 创建旋转控制点
        const rotateHandle = document.createElement('div');
        rotateHandle.className = 'rotate-handle';
        rotateHandle.style.position = 'absolute';
        rotateHandle.style.width = `${rotateHandleSize}px`;
        rotateHandle.style.height = `${rotateHandleSize}px`;
        rotateHandle.style.borderRadius = '50%';
        rotateHandle.style.backgroundColor = '#ff9800';
        rotateHandle.style.border = '2px solid white';
        rotateHandle.style.boxShadow = '0 0 4px rgba(0,0,0,0.5)';
        rotateHandle.style.top = `${handleTop}px`;
        rotateHandle.style.left = `${handleLeft}px`;
        rotateHandle.style.cursor = 'grab';
        rotateHandle.style.zIndex = '20';
        rotateHandle.style.display = 'flex';
        rotateHandle.style.alignItems = 'center';
        rotateHandle.style.justifyContent = 'center';
        rotateHandle.innerHTML = '<div style="transform: rotate(90deg)">↻</div>';
        
        // 添加连接线，从格子中心到控制点
        const line = document.createElement('div');
        line.style.position = 'absolute';
        line.style.width = '2px';
        line.style.height = `${(currentCellData.height/2 + distanceFromBorder) * scaleRatio}px`;
        line.style.backgroundColor = '#ff9800';
        line.style.top = `${handleTop + rotateHandleSize/2}px`;
        line.style.left = `${handleLeft + rotateHandleSize/2 - 1}px`;
        line.style.zIndex = '15';
        line.style.transformOrigin = 'bottom center';
        line.style.transform = 'translateY(100%)';
        
        interactionLayer.appendChild(line);
        interactionLayer.appendChild(rotateHandle);
        
        // 处理旋转操作的鼠标事件
        rotateHandle.addEventListener('mousedown', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            rotateState.isRotating = true;
            
            // 计算初始角度
            const rect = svgEl.getBoundingClientRect();
            const centerX = center.x * scaleRatio + rect.left;
            const centerY = center.y * scaleRatio + rect.top;
            
            rotateState.centerX = centerX;
            rotateState.centerY = centerY;
            rotateState.startAngle = Math.atan2(
                e.clientY - centerY,
                e.clientX - centerX
            ) * 180 / Math.PI;
            rotateState.initialRotation = imageTransforms[editingCellIdx].rotation || 0;
            
            // 改变鼠标指针样式
            rotateHandle.style.cursor = 'grabbing';
            document.body.style.cursor = 'grabbing';
            
            // 绑定鼠标移动和松开事件
            document.addEventListener('mousemove', handleRotateMouseMove);
            document.addEventListener('mouseup', handleRotateMouseUp);
        });
        
        // 触摸设备支持
        rotateHandle.addEventListener('touchstart', function(e) {
            e.preventDefault();
            
            rotateState.isRotating = true;
            
            // 计算初始角度
            const rect = svgEl.getBoundingClientRect();
            const centerX = center.x * scaleRatio + rect.left;
            const centerY = center.y * scaleRatio + rect.top;
            const touch = e.touches[0];
            
            rotateState.centerX = centerX;
            rotateState.centerY = centerY;
            rotateState.startAngle = Math.atan2(
                touch.clientY - centerY,
                touch.clientX - centerX
            ) * 180 / Math.PI;
            rotateState.initialRotation = imageTransforms[editingCellIdx].rotation || 0;
            
            document.addEventListener('touchmove', handleRotateTouchMove, {passive: false});
            document.addEventListener('touchend', handleRotateTouchEnd, {passive: false});
        });
    }
    
    renderArea.appendChild(interactionLayer);
    interactionLayer.style.width = `${svgRect.width}px`;
    interactionLayer.style.height = `${svgRect.height}px`;
    
    // 处理交互层的鼠标拖拽事件 - 当前编辑格子
    if (editingCellIdx !== null) {
        const currentCell = interactionLayer.querySelector(`.cell-selector[data-idx="${editingCellIdx}"]`);
        if (currentCell) {
            // 鼠标拖拽
            currentCell.addEventListener('mousedown', function(e) {
                dragState.isDragging = true;
                dragState.startX = e.clientX;
                dragState.startY = e.clientY;
                dragState.lastOffsetX = imageTransforms[editingCellIdx].offsetX;
                dragState.lastOffsetY = imageTransforms[editingCellIdx].offsetY;
                e.preventDefault();
                
                // 添加全局移动和结束监听
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
            
            // 鼠标滚轮缩放
            currentCell.addEventListener('wheel', function(e) {
                e.preventDefault();
                const delta = e.deltaY;
                let t = imageTransforms[editingCellIdx];
                let newScale = t.scale * (delta > 0 ? 0.9 : 1.1);
                newScale = Math.max(0.5, Math.min(5, newScale));
                t.scale = newScale;
                renderPreview();
            });
            
            // 移动端触摸
            currentCell.addEventListener('touchstart', handleTouchStart, {passive: false});
            currentCell.addEventListener('touchmove', handleTouchMove, {passive: false});
            currentCell.addEventListener('touchend', handleTouchEnd, {passive: false});
        }
    }
    
    function handleMouseMove(e) {
        if (dragState.isDragging && editingCellIdx !== null) {
            const dx = e.clientX - dragState.startX;
            const dy = e.clientY - dragState.startY;
            
            // 根据SVG和视口的比例调整偏移量
            const svgRect = document.getElementById('preview-svg').getBoundingClientRect();
            const scaleX = sizeW / svgRect.width;
            const scaleY = sizeH / svgRect.height;
            
            imageTransforms[editingCellIdx].offsetX = dragState.lastOffsetX + dx * scaleX;
            imageTransforms[editingCellIdx].offsetY = dragState.lastOffsetY + dy * scaleY;
            
            renderPreview();
        }
    }
    
    function handleMouseUp(e) {
        dragState.isDragging = false;
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
    }
    
    // 触摸处理
    let lastTouches = [];
    
    function handleTouchStart(e) {
        e.preventDefault();
        const touches = e.touches;
        
        if (touches.length === 1) {
            // 单指拖动
            dragState.isDragging = true;
            dragState.startX = touches[0].clientX;
            dragState.startY = touches[0].clientY;
            dragState.lastOffsetX = imageTransforms[editingCellIdx].offsetX;
            dragState.lastOffsetY = imageTransforms[editingCellIdx].offsetY;
        } 
        else if (touches.length === 2) {
            // 双指缩放 - 保存初始状态
            lastTouches = Array.from(touches).map(t => ({
                x: t.clientX,
                y: t.clientY
            }));
        }
    }
    
    function handleTouchMove(e) {
        e.preventDefault();
        const touches = e.touches;
        
        if (touches.length === 1 && dragState.isDragging) {
            // 单指拖动
            const dx = touches[0].clientX - dragState.startX;
            const dy = touches[0].clientY - dragState.startY;
            
            // 根据SVG和视口的比例调整偏移量
            const svgRect = document.getElementById('preview-svg').getBoundingClientRect();
            const scaleX = sizeW / svgRect.width;
            const scaleY = sizeH / svgRect.height;
            
            imageTransforms[editingCellIdx].offsetX = dragState.lastOffsetX + dx * scaleX;
            imageTransforms[editingCellIdx].offsetY = dragState.lastOffsetY + dy * scaleY;
            
            renderPreview();
        }
        else if (touches.length === 2 && lastTouches.length === 2) {
            // 双指缩放
            const currentTouches = Array.from(touches).map(t => ({
                x: t.clientX,
                y: t.clientY
            }));
            
            const initialDistance = Math.hypot(
                lastTouches[0].x - lastTouches[1].x,
                lastTouches[0].y - lastTouches[1].y
            );
            
            const currentDistance = Math.hypot(
                currentTouches[0].x - currentTouches[1].x,
                currentTouches[0].y - currentTouches[1].y
            );
            
            const scaleFactor = currentDistance / initialDistance;
            let newScale = imageTransforms[editingCellIdx].scale * scaleFactor;
            newScale = Math.max(0.5, Math.min(5, newScale));
            
            imageTransforms[editingCellIdx].scale = newScale;
            lastTouches = currentTouches;
            
            renderPreview();
        }
    }
    
    function handleTouchEnd(e) {
        dragState.isDragging = false;
        lastTouches = [];
    }
    
    // 旋转处理函数
    function handleRotateMouseMove(e) {
        if (rotateState.isRotating && editingCellIdx !== null) {
            const currentAngle = Math.atan2(
                e.clientY - rotateState.centerY,
                e.clientX - rotateState.centerX
            ) * 180 / Math.PI;
            
            // 计算角度差
            let angleDiff = currentAngle - rotateState.startAngle;
            
            // 应用旋转
            imageTransforms[editingCellIdx].rotation = (rotateState.initialRotation + angleDiff) % 360;
            
            renderPreview();
        }
    }
    
    function handleRotateMouseUp(e) {
        rotateState.isRotating = false;
        document.body.style.cursor = 'default';
        document.removeEventListener('mousemove', handleRotateMouseMove);
        document.removeEventListener('mouseup', handleRotateMouseUp);
    }
    
    // 触摸旋转处理
    function handleRotateTouchMove(e) {
        e.preventDefault();
        if (rotateState.isRotating && editingCellIdx !== null && e.touches.length > 0) {
            const touch = e.touches[0];
            const currentAngle = Math.atan2(
                touch.clientY - rotateState.centerY,
                touch.clientX - rotateState.centerX
            ) * 180 / Math.PI;
            
            // 计算角度差
            let angleDiff = currentAngle - rotateState.startAngle;
            
            // 应用旋转
            imageTransforms[editingCellIdx].rotation = (rotateState.initialRotation + angleDiff) % 360;
            
            renderPreview();
        }
    }
    
    function handleRotateTouchEnd(e) {
        rotateState.isRotating = false;
        document.removeEventListener('touchmove', handleRotateTouchMove);
        document.removeEventListener('touchend', handleRotateTouchEnd);
    }
}

// 下载拼图
document.getElementById('download-btn').onclick = function() {
    if (selectedTemplateIdx === null || uploadedImages.length === 0) {
        alert('请先选择模板并上传图片');
        return;
    }
    
    const svgEl = document.getElementById('preview-svg');
    if (!svgEl) return;
    
    // 复制SVG以防止修改原始SVG
    const svgClone = svgEl.cloneNode(true);
    
    // 设置背景色（默认SVG背景是透明的）
    svgClone.style.backgroundColor = 'white';
    
    // 将所有边框统一为黑色（移除高亮状态）
    const polygons = svgClone.querySelectorAll('polygon');
    polygons.forEach(polygon => {
        if (polygon.getAttribute('fill') !== 'none') {
            // 这是格子的背景多边形，保持原样
        } else {
            // 这是边框多边形，统一为黑色
            polygon.setAttribute('stroke', '#000000');
            polygon.setAttribute('stroke-width', '3');
        }
    });
    
    // 获取SVG的尺寸
    const originalWidth = 300, originalHeight = 480;
    
    // 导出时使用更高的分辨率（4倍于原始尺寸）
    const exportScale = 4;
    const exportWidth = originalWidth * exportScale;
    const exportHeight = originalHeight * exportScale;
    
    // 将SVG序列化为字符串
    const serializer = new XMLSerializer();
    const svgString = serializer.serializeToString(svgClone);
    
    // 创建一个基础的SVG字符串（包含XML声明）
    const svgBlob = new Blob([svgString], {type: 'image/svg+xml;charset=utf-8'});
    const url = URL.createObjectURL(svgBlob);
    
    // 创建一个Image对象来加载SVG
    const img = new Image();
    img.onload = function() {
        // 创建Canvas元素（使用更高的分辨率）
        const canvas = document.createElement('canvas');
        canvas.width = exportWidth;
        canvas.height = exportHeight;
        const ctx = canvas.getContext('2d');
        
        // 启用图像平滑处理，提高质量
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        
        // 在Canvas上绘制图片
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
        
        // 转换Canvas为PNG图片URL（使用更高质量）
        try {
            const pngUrl = canvas.toDataURL('image/png', 1.0); // 1.0表示最高质量
            
            // 创建一个下载链接
            const downloadLink = document.createElement('a');
            downloadLink.href = pngUrl;
            
            // 获取当前日期时间作为文件名
            const now = new Date();
            const fileName = `拼图_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}_${now.getHours().toString().padStart(2,'0')}${now.getMinutes().toString().padStart(2,'0')}.png`;
            
            downloadLink.download = fileName;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            
            // 释放URL对象
            URL.revokeObjectURL(url);
        } catch (e) {
            console.error('导出图片失败:', e);
            alert('导出图片失败: ' + e.message);
        }
    };
    
    img.onerror = function() {
        console.error('加载SVG失败');
        alert('生成图片失败，请重试');
        URL.revokeObjectURL(url);
    };
    
    // 设置图片源
    img.src = url;
    
    // 显示正在处理的提示
    alert('正在生成拼图，请稍等...');
};

// 初始化
window.onload = function() {
    renderTemplateList(templates);
}; 