let mapManager = {
    mapData: null,
    tLayers: [],
    xCount: 0, // блоков по горизонтали
    yCount: 0, // блоков по вертикали
    tSize: { x: 16, y: 16 }, // размер тайла
    mapSize: { x: 0, y: 0 }, // размер карты в пикселях (вычисляется потом)
    tilesets: [],
    collisionLayer: null,
    groundLayer: null,

    // признаки загрузки
    imgLoadCount: 0, // количество подгруженных изображений
    imgLoaded: false, // загружены ли все изображения
    jsonLoaded: false, // загружен ли json файл с описанием карты

    imgDir: "img/",

    loadMap(path) {
        const request = new XMLHttpRequest(); // создание ajax-запроса
        request.onreadystatechange = () => {
            if (request.readyState === 4) {
                if (request.status === 200) {
                    mapManager.parseMap(request.responseText);
                } else {
                    console.error("Не удалось загрузить карту:", request.status, request.statusText);
                }
            }
        };
        request.open("GET", path, true); // true - отправить асинхронный запрос на path
        request.send(); // отправить запрос
    },

    // разбор JSON карты
    parseMap(tilesJSON) {
        this.mapData = JSON.parse(tilesJSON);

        this.xCount = this.mapData.width; // количество блоков в ширину
        this.yCount = this.mapData.height; // количество блоков в высоту

        this.tSize.x = this.mapData.tilewidth; // ширина одного блока
        this.tSize.y = this.mapData.tileheight; // высота одного блока

        this.mapSize.x = this.xCount * this.tSize.x; // вычисление размера карты
        this.mapSize.y = this.yCount * this.tSize.y; // вычисление размера карты

        // собираем все слои тайлов
        this.tLayers = [];
        for (let i = 0; i < this.mapData.layers.length; i++) {
            const layer = this.mapData.layers[i];
            if (layer.type === "tilelayer") {
                this.tLayers.push(layer);
                if (layer.name === "Collision") this.collisionLayer = layer;
                if (layer.name === "Ground") this.groundLayer = layer;
            }
        }

        // подготавливаем tilesets
        this.tilesets = [];
        this.imgLoadCount = 0;
        this.imgLoaded = false;
        this.jsonLoaded = false;

        // каждый tileset из карты
        for (let i = 0; i < this.mapData.tilesets.length; i++) {
            const ts = this.mapData.tilesets[i];

            let imageName = ts.image || ts.source;
            imageName = this.imgDir + imageName;

            const img = new Image();

            const tileset = {
                firstgid: ts.firstgid, // с чего начинается нумерация
                image: imageName, // имя
                img: img, // объект рисунка
                xCount: 0, // горизонталь
                yCount: 0 // вертикаль
            };

            img.onload = () => { // при загрузке изображения
                tileset.xCount = Math.floor(img.width / mapManager.tSize.x);
                tileset.yCount = Math.floor(img.height / mapManager.tSize.y);

                this.imgLoadCount++;
                if (this.imgLoadCount === this.mapData.tilesets.length) {
                    this.imgLoaded = true; // загружены все изображения
                }
            };

            img.onerror = () => {
                console.error("Не удалось загрузить изображение tileset:", imageName);
            };

            img.src = imageName;
            this.tilesets.push(tileset);
        }
        this.jsonLoaded = true;
    },

    // поиск набора тайлов по индексу тайла
    getTileset(tileIndex) {
        for (let i = this.tilesets.length - 1; i >= 0; i--) {
            const ts = this.tilesets[i];
            if (tileIndex >= ts.firstgid) {
                return ts; // возвращается найденный tileset
            }
        }
        return null;
    },

    // получение информации о конкретном тайле
    getTile(tileIndex) {
        const tileset = this.getTileset(tileIndex);
        if (!tileset) return null;

        // локальный индекс внутри картинки tileset
        const localId = tileIndex - tileset.firstgid;

        const x = localId % tileset.xCount;
        const y = Math.floor(localId / tileset.xCount);

        return { // возвращаем блок для отображения
            img: tileset.img,
            sx: x * this.tSize.x,
            sy: y * this.tSize.y,
            sWidth: this.tSize.x,
            sHeight: this.tSize.y
        };
    },

    // отрисовка карты в контексте
    draw(ctx) {
        // если карта не загружена, то повторить прорисовку через 100 мсек
        if (!mapManager.imgLoaded || !mapManager.jsonLoaded) {
            setTimeout(() => mapManager.draw(ctx), 100);
        } else {
            // проходим по всем tile-слоям по порядку
            for (let l = 0; l < this.tLayers.length; l++) {
                const layer = this.tLayers[l];
                const data = layer.data;
                for (let i = 0; i < data.length; i++) { // проходим по карте
                    const tileIndex = data[i];
                    if (tileIndex === 0) continue; // если нет данных - пропускаем

                    const tile = this.getTile(tileIndex);
                    if (!tile) continue;

                    // координаты на карте
                    const px = (i % this.xCount) * this.tSize.x;
                    const py = Math.floor(i / this.xCount) * this.tSize.y;

                    ctx.drawImage(
                        tile.img,
                        tile.sx, tile.sy, tile.sWidth, tile.sHeight,
                        px, py, this.tSize.x, this.tSize.y
                    );
                }
            }
        }
    },

    parseEntities() { // разбор слоя объектов
        if (!mapManager.imgLoaded || !mapManager.jsonLoaded) {
            setTimeout(() => this.parseEntities(), 100);
        } else {
            for (let layer of this.mapData.layers) {
                if (layer.type === "objectgroup" && layer.name === "Entities") {
                    for (let o of layer.objects) {
                        const proto = gameManager.factory[o.type];
                        if (!proto) {
                            console.warn("Неизвестный тип объекта:", o.type);
                            continue;
                        }
                        const obj = Object.create(proto);

                        obj.name = o.name || o.type;
                        obj.type = o.type;

                        if (o.type === "Bomb" || o.type === "Chest") {
                            obj.pos_x = o.x;
                            obj.pos_y = o.y;
                            obj.size_x = o.width;
                            obj.size_y = o.height;

                            obj.block_x = Math.floor(o.width / 2) - 8; // смещение от pos_x
                            obj.block_y = Math.floor(o.height / 2) - 8; // смещение от pos_y
                            obj.block_w = 16;
                            obj.block_h = 16;
                        } else {
                            obj.pos_x = o.x;
                            obj.pos_y = o.y;
                            obj.size_x = o.width;
                            obj.size_y = o.height;
                        }



                        obj.props = {};
                        if (o.properties) {
                            for (let p of o.properties) {
                                obj.props[p.name] = p.value;
                            }
                        }

                        if (typeof obj.init === "function") {
                            obj.init(o);
                        }

                        gameManager.entities.push(obj);
                        if (obj.type === "Player") {
                            gameManager.initPlayer(obj);
                        }
                    }
                }
            }
        }
    },

    // индекс в массиве данных
    _getIndex(x, y) {
        const wX = x;
        const wY = y;
        return Math.floor(wY / this.tSize.y) * this.xCount +
            Math.floor(wX / this.tSize.x);
    },

    // по слою коллизий
    getTilesetIdx(x, y) {
        let idx = this._getIndex(x, y);

        return this.collisionLayer.data[idx];
    },

    getGroundIdx(x, y) {
        let idx = this._getIndex(x, y)
        return this.groundLayer.data[idx];
    },

    // выход за границы карты
    isOutOfBounds(x, y, w = 0, h = 0) {
        return (x < 0 || y < 0 || x + w > this.mapSize.x || y + h > this.mapSize.y);
    },

    // проверка, что по координатам лава
    isLava(x, y) {
        const tileIndex = this.getGroundIdx(x, y);
        if (!tileIndex) return false;

        const ts = this.getTileset(tileIndex);
        if (!ts) return false;

        // файл lava_tileset.png
        return ts.image.indexOf("lava") !== -1;
    },

    // изменяет тайлы в прямоугольнике
    changeTilesRect(layerName, x1, y1, x2, y2, fromTile, toTile) {
        let layer = null;
        if (layerName === "Ground") layer = this.groundLayer;
        if (layerName === "Collision") layer = this.collisionLayer;
        if (!layer) return;
        for (let y = y1; y < y2; y += this.tSize.y) {
            for (let x = x1; x < x2; x += this.tSize.x) {
                const idx = this._getIndex(x + this.tSize.x / 2,
                    y + this.tSize.y / 2);
                if (layer.data[idx] === fromTile + 113) {
                    layer.data[idx] = toTile;
                }
            }
        }
    },

    openCenterLavaArea() {
        this.changeTilesRect("Ground", 208, 208, 240, 240, 0, 4);
    }
};
