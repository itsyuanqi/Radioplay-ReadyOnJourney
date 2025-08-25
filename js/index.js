const selectedPeople = new Set();

async function loadScriptFile(filename) {
    const res = await fetch("script/" + filename);
    const lines = (await res.text()).split('\n');
    return lines;
}

function extractLinesBetweenMarkers(lines, startMarker, endMarker) {
    const startIdx = lines.findIndex(line => line.trim() === `*${startMarker}`);
    const endIdx = lines.findIndex(line => line.trim() === `**${startMarker}`);
    if (startIdx === -1 || endIdx === -1 || endIdx <= startIdx) return [];
    return lines.slice(startIdx + 1, endIdx).filter(line => line.trim() !== '');
}

function parseDialogueBlock(lines) {
    const dialogue = [];
    let currentId = null;
    let currentOverride = {};
    let buffer = [];

    const propRegex = /\[([^=\]]+)=([^\]]+)\]/g;

    for (let line of lines) {
        const trimmed = line.trim();

        // 新格式匹配
        const tagMatch = trimmed.match(/^\[(.+?)\](.*)$/);

        if (tagMatch) {
            if (currentId && buffer.length) {
                dialogue.push({
                    id: currentId,
                    text: buffer.join('<br>'),
                    override: currentOverride
                });
            }

            currentId = tagMatch[1];
            currentOverride = {};
            buffer = [];

            const rest = tagMatch[2];
            let match;
            while ((match = propRegex.exec(rest)) !== null) {
                const key = match[1].trim();
                const valueRaw = match[2].trim();
                let value = valueRaw;
                if (valueRaw === 'true') value = true;
                else if (valueRaw === 'false') value = false;
                else if (valueRaw.startsWith('#')) value = valueRaw;
                currentOverride[key] = value;
            }
        } else if (trimmed === '') {
            buffer.push('');
        } else {
            buffer.push(trimmed);
        }
    }

    if (currentId && buffer.length) {
        dialogue.push({
            id: currentId,
            text: buffer.join('<br>'),
            override: currentOverride
        });
    }

    return dialogue;
}

async function init() {
    const configRes = await fetch('config.json');
    const config = await configRes.json();

    const container = document.getElementById('scene-container');
    const buttonContainer = document.getElementById('scene-buttons');
    const charSelectDiv = document.getElementById('character-select');

    const avatarCache = new Map();
    window.selectedPeople = new Set();

    // === 新增：缓存所有 scene ===
    const sceneCache = {};

    // 先预加载所有 scene 文件
    for (const sceneId in config.scene) {
        const [filename, title] = config.scene[sceneId];
        const lines = await loadScriptFile(filename);
        const dialogueLines = extractLinesBetweenMarkers(lines, sceneId, sceneId);
        const dialogues = parseDialogueBlock(dialogueLines);
        sceneCache[sceneId] = dialogues;  // 存好结果，避免点击时再 fetch
    }

    // 渲染勾选框
    const nameToIds = {};
    for (const [id, data] of Object.entries(config.member_map)) {
        if (data.shownHighlightSelection) {
            const name = data.name;
            if (!nameToIds[name]) nameToIds[name] = [];
            nameToIds[name].push(id);
        }
    }

    for (const name in nameToIds) {
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.dataset.ids = nameToIds[name].join(',');
        checkbox.id = `check-${name}`;

        const label = document.createElement('label');
        label.htmlFor = checkbox.id;
        label.appendChild(checkbox);
        label.append(` ${name}`);

        checkbox.addEventListener('change', (e) => {
            const ids = e.target.dataset.ids.split(',');
            ids.forEach(id => {
                if (e.target.checked) selectedPeople.add(id);
                else selectedPeople.delete(id);
            });
            updateHighlights?.();
        });

        charSelectDiv.appendChild(label);
    }

    // 渲染按钮 & scene DOM
    for (const sceneId in config.scene) {
        const [filename, title] = config.scene[sceneId];
        const btn = document.createElement('button');
        btn.textContent = `Scene ${sceneId}: ${title}`;
        btn.classList.add('scene-button');
        btn.dataset.scene = sceneId;
        buttonContainer.appendChild(btn);

        const sceneDiv = document.createElement('div');
        sceneDiv.classList.add('scene-tab');
        sceneDiv.id = `scene-${sceneId}`;

        const table = document.createElement('table');
        for (const { id, text, override } of sceneCache[sceneId]) {
            const tr = document.createElement('tr');
            tr.dataset.charid = id;

            const charName = override?.Name || config.id_map[id] || id;
            const charColor = override?.color || config.member_map[id]?.color || '#000';
            const avatarFilename = override?.avatar || config.member_map[id]?.avatar;
            const isSilhouette = override?.silhouette ?? config.member_map[id]?.silhouette === true;
            const imgSrc = avatarFilename ? `avatar/${avatarFilename}` : null;

            const tdInfo = document.createElement('td');
            tdInfo.style.display = 'flex';
            tdInfo.style.alignItems = 'center';
            tdInfo.style.gap = '10px';

            const imgWrapper = document.createElement('div');
            Object.assign(imgWrapper.style, {
                width: '40px', height: '40px', flexShrink: '0',
                background: '#ccc', borderRadius: '5px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden'
            });

            const charImg = new Image();
            charImg.style.width = '100%';
            charImg.style.height = '100%';
            charImg.style.objectFit = 'cover';
            charImg.draggable = false;

            const cacheKey = `${id}-${isSilhouette ? 's' : 'n'}`;
            const colorHex = config.member_map[id]?.color || '#000000';

            if (imgSrc) {
                if (avatarCache.has(cacheKey)) {
                    charImg.src = avatarCache.get(cacheKey);
                    imgWrapper.appendChild(charImg);
                } else {
                    charImg.onload = () => {
                        if (isSilhouette) {
                            const canvas = document.createElement('canvas');
                            canvas.width = charImg.naturalWidth;
                            canvas.height = charImg.naturalHeight;
                            const ctx = canvas.getContext('2d');
                            ctx.drawImage(charImg, 0, 0);
                            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                            const data = imageData.data;

                            const hex = override?.silhouetteColor || config.member_map[id]?.silhouetteColor || '#888888';
                            const r = parseInt(hex.slice(1, 3), 16);
                            const g = parseInt(hex.slice(3, 5), 16);
                            const b = parseInt(hex.slice(5, 7), 16);

                            for (let i = 0; i < data.length; i += 4) {
                                if (data[i + 3] > 0) {
                                    data[i] = r;
                                    data[i + 1] = g;
                                    data[i + 2] = b;
                                }
                            }
                            ctx.putImageData(imageData, 0, 0);
                            const recoloredURL = canvas.toDataURL();
                            avatarCache.set(cacheKey, recoloredURL);
                            charImg.src = recoloredURL;
                        } else {
                            avatarCache.set(cacheKey, imgSrc);
                        }
                        imgWrapper.appendChild(charImg);
                    };
                    charImg.src = imgSrc;
                }
            }

            const avatarBackgroundColor = override?.avatarBackgroundColor || config.member_map[id]?.avatarBackgroundColor || `${charColor}33`;
            imgWrapper.style.background = avatarBackgroundColor;

            tdInfo.appendChild(imgWrapper);
            const nameSpan = document.createElement('span');
            nameSpan.textContent = charName;
            nameSpan.style.color = charColor;
            tdInfo.appendChild(nameSpan);

            const tdText = document.createElement('td');
            tdText.innerHTML = text.replace(/\\n/g, '<br>');
            tdText.style.color = charColor;

            tr.appendChild(tdInfo);
            tr.appendChild(tdText);
            table.appendChild(tr);
        }

        sceneDiv.appendChild(table);
        container.appendChild(sceneDiv);

        // 按钮点击只是切换 active，不再 fetch
        btn.addEventListener('click', () => {
            document.querySelectorAll('.scene-tab').forEach(tab => tab.classList.remove('active'));
            document.querySelectorAll('.scene-button').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sceneDiv.classList.add('active');
            document.querySelector('.main-content')?.scrollTo({ top: 0 });
            if (window.innerHeight > window.innerWidth) {
                document.querySelector('.app-container')?.classList.add('collapsed');
            }
        });
    }

    // 自动激活第一个按钮
    const firstBtn = buttonContainer.querySelector('.scene-button');
    if (firstBtn) firstBtn.click();
}


function updateHighlights() {
    document.querySelectorAll('tr[data-charid]').forEach(tr => {
        const id = tr.dataset.charid;

        if (id === "Everyone") {
            // 特例，只要有人被选中，就高亮 Everyone 的台词
            if (selectedPeople.size > 0) {
                tr.classList.add('highlight-line');
            } else {
                tr.classList.remove('highlight-line');
            }
        } else {
            if (selectedPeople.has(id)) {
                tr.classList.add('highlight-line');
            } else {
                tr.classList.remove('highlight-line');
            }
        }
    });
}

window.addEventListener('DOMContentLoaded', () => {
    init();
});