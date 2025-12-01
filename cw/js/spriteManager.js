let spriteManager = {
    image: new Image(),
    sprites: [],
    imgLoaded: false,
    jsonLoaded: false,

    loadAtlas(atlasJson, atlasImg) {
        let request = new XMLHttpRequest(); // подготовить запрос на разбор атласа
        request.onreadystatechange = () => {
            if (request.readyState === 4) {
                if (request.status === 200) {
                    spriteManager.parseAtlas(request.responseText);
                } else {
                    console.error("Не удалось загрузить атлас:", request.status, request.statusText);
                }
            }
        };
        request.open("GET", atlasJson, true); // true - отправить асинхронный запрос на разбор атласа
        request.send(); // отправить запрос
        this.loadImg(atlasImg); //загрузка изображения
    },

    loadImg(imgName) {
        this.image.onload = () => {
            spriteManager.imgLoaded = true;
        }
        this.image.src = imgName; // загрузка изображения
    },

    parseAtlas(atlasJSON) {
        let atlas = JSON.parse(atlasJSON);
        for (let name in atlas.frames) { // проход по всем именам в frames
            let frame = atlas.frames[name].frame // полочение спрайта
            // сохранение характеристик в виде объекта
            this.sprites.push({ name: name, x: frame.x, y: frame.y, w: frame.w, h: frame.h })
        }
        this.jsonLoaded = true;
    },

    drawSprite(ctx, name, x, y, flipX = false) {
        // если изображение не загружено, то повторить запрос через 100 мсек
        if (!this.imgLoaded || !this.jsonLoaded) {
            setTimeout(() => { this.drawSprite(ctx, name, x, y) }, 100);
        } else {
            let sprite = this.getSprite(name);
            if (!flipX) {
                ctx.drawImage(this.image, sprite.x, sprite.y, sprite.w, sprite.h,
                    x, y, sprite.w, sprite.h
                ); // отображение спрайта на холсте
            } else {
                ctx.save();
                ctx.translate(x + sprite.w, y);
                ctx.scale(-1, 1);
                ctx.drawImage(this.image, sprite.x, sprite.y, sprite.w, sprite.h,
                    0, 0, sprite.w, sprite.h
                );
                ctx.restore();
            }
        }
    },

    getSprite(name) {
        for (let i = 0; i < this.sprites.length; i++) {
            let s = this.sprites[i];
            if (s.name === name) {
                return s;
            }
        }
        return null;
    }
};
