let Entity = {
    pos_x: 0, // позиция объекта
    pos_y: 0,
    size_x: 16, // размер по умолчанию
    size_y: 16,

    extend(extendProto) { // расширение сущности
        let object = Object.create(this); // создание нового объекта
        for (let property in extendProto) // для всех свойств нового объекта
        {
            // если нет в родительском - добавить
            if (this.hasOwnProperty(property) || typeof object[property] === 'undefined') {
                object[property] = extendProto[property];
            }
        }
        return object;
    },

    update() { },
    draw(ctx) { },
    onTouchMap(kind) { },
    onTouchEntity(other) { }
};

let Player = Entity.extend({
    type: "Player",
    life: 1, // количество жизней
    scores: 0, // очки
    speed: 2, // скорость
    move_x: 0, // направление движения
    move_y: 0,
    direction: "down", // "down", "up", "left", "right"

    fireCooldown: 1000, // мс
    lastShotTime: 0,

    keys: { 1: false, 2: false }, // 1 - серебряный от сундука, 2 - от двери

    animations: {
        down: ["ninja_front_0", "ninja_front_1", "ninja_front_2"],
        up: ["ninja_back_0", "ninja_back_1", "ninja_back_2"],
        left: ["ninja_side_0", "ninja_side_1", "ninja_side_2"],
        right: ["ninja_side_0", "ninja_side_1", "ninja_side_2"]
    },

    frame: 0,
    frameCounter: 0,
    frameDelay: 8,

    update() {
        // направление
        if (this.move_x < 0) this.direction = "left";
        else if (this.move_x > 0) this.direction = "right";
        else if (this.move_y < 0) this.direction = "up";
        else if (this.move_y > 0) this.direction = "down";

        // анимация
        if (this.move_x || this.move_y) {
            this.frameCounter++;
            if (this.frameCounter >= this.frameDelay) {
                this.frameCounter = 0;
                this.frame = (this.frame + 1) % this.animations[this.direction].length;
            }
        } else {
            this.frameCounter = 0;
            this.frame = 1;
        }

        // физика
        physicManager.update(this);
    },

    draw(ctx) {
        const anim = this.animations[this.direction];
        const sprite = anim ? anim[this.frame] : "ninja_front_1";
        if (this.direction === "right") {
            spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y, true);
        } else {
            spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
        }
    },

    fire() {
        const now = performance.now ? performance.now() : Date.now();
        if (now - this.lastShotTime < this.fireCooldown) return;
        this.lastShotTime = now;

        // центр игрока
        const centerX = this.pos_x + this.size_x / 2 - 8;
        const centerY = this.pos_y + this.size_y / 2 - 8;

        const proj = Shuriken.create(centerX, centerY, this.direction);
        gameManager.entities.push(proj);
        soundManager.play("shuriken", { volume: 0.2 });
    },


    onTouchMap(kind) {
        if (kind === "lava") {
            console.log("Лава! Сюда нельзя.");
        }
    },

    onTouchEntity(other) {
        if (other.type === "Bomb") {
            other.trigger();
        }
        if (other.type === "Chest") {
            other.tryOpen(this);
        }
        if (other.type === "Door") {
            other.tryOpen(this);
        }
        if (other.type === "SilverKey") {
            other.pick(this);
        }
    }
});

let SilverKey = Entity.extend({
    type: "SilverKey",
    size_x: 16,
    size_y: 16,

    draw(ctx) {
        spriteManager.drawSprite(ctx, "silver_key", this.pos_x, this.pos_y);
    },

    pick(player) {
        player.keys[1] = true; // ключ от сундука
        console.log("Серебряный ключ подобран.");
        gameManager.kill(this);
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            this.pick(other);
        }
    }
});

let Chest = Entity.extend({
    type: "Chest",
    size_x: 32,
    size_y: 32,
    opened: false,
    hintedNoKey: false,

    draw(ctx) {
        const sprite = this.opened ? "chest_3" : "chest_0";
        spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
    },

    stopPlayer(player) {
        // полностью останавливаем игрока
        player.move_x = 0;
        player.move_y = 0;

        // сбрасываем зажатые кнопки
        if (typeof eventsManager !== "undefined" &&
            typeof eventsManager.clearActions === "function") {
            eventsManager.clearActions();
        }
    },

    tryOpen(player) {
        if (this.opened) return;

        const needKey = this.props.needKey || 1;
        const contains = this.props.contains || "";

        // проверка, что есть нужный ключ
        if (!player.keys[needKey]) {
            if (!this.hintedNoKey) {
                alert("Сундук заперт.\nСначала найдите серебряный ключ в правом нижнем углу подземелья.");
                this.hintedNoKey = true;
            }
            this.stopPlayer(player);
            return;
        }

        this.opened = true;
        soundManager.play("chest_open", { volume: 0.8 });
        console.log("Сундук открыт!");

        // содержимое - золотой ключ
        if (contains === "key2") {
            player.keys[2] = true;
            alert("Вы открыли сундук и получили ЗОЛОТОЙ ключ.\nТеперь вы можете открыть главную дверь.");
            this.stopPlayer(player);
        }
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            this.tryOpen(other);
        }
    }
});

let Door = Entity.extend({
    type: "Door",
    size_x: 32,
    size_y: 48,
    opened: false,

    draw(ctx) {
        const sprite = this.opened ? "door_2" : "door_0";
        spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
    },

    tryOpen(player) {
        if (this.opened) return;

        const needKey = this.props.needKey || 2;
        if (!player.keys[needKey]) {
            console.log("Дверь заперта. Нужен золотой ключ.");
            return;
        }

        this.opened = true;
        soundManager.play("door_open", { volume: 0.8 });
        gameManager.finishGame(true);
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            this.tryOpen(other);
        }
    }
});

let Lever = Entity.extend({
    type: "Lever",
    size_x: 16,
    size_y: 16,
    activated: false,

    draw(ctx) {
        const sprite = this.activated ? "lever_1" : "lever_0";
        spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
    },

    activate() {
        if (this.activated) return;
        this.activated = true;
        const layerName = this.props.targetLayer || "Ground";
        const fromTile = this.props.fromTile || 0;
        const toTile = this.props.toTile || 0;

        const x1 = this.props.x1 || 0;
        const x2 = this.props.x2 || 0;
        const y1 = this.props.y1 || 0;
        const y2 = this.props.y2 || 0;

        mapManager.changeTilesRect(layerName, x1, y1, x2, y2, fromTile, toTile);
        console.log("Рычаг активирован, лава перекрыта.");
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            soundManager.play("lever", { volume: 0.8 });
            this.activate();
        }
    }
});

let Bomb = Entity.extend({
    type: "Bomb",
    size_x: 16,
    size_y: 16,

    state: "idle",
    timer: 0, // счётчик мс до взрыва
    frame: 0,

    blinkDelay: 150, // скорость мигания
    explosionFrameDelay: 80,

    draw(ctx) {
        let sprite = "bomb_blink_0";

        if (this.state === "idle") {
            sprite = "bomb_blink_0";
        } else if (this.state === "armed") { // мигание
            const idx = Math.floor(this.timer / this.blinkDelay) % 4;
            sprite = "bomb_blink_" + idx;
        } else if (this.state === "explosion") {
            const idx = Math.min(this.frame, 3);
            sprite = "bomb_explosion_" + idx;
        }

        spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
    },

    update() {
        if (this.state === "idle") return;

        // обновляется примерно каждые 30 мс
        const dt = 30;

        if (this.state === "armed") {
            this.timer += dt;
            if (this.timer >= 2000) { // 2 секунды
                this.state = "explosion";
                this.timer = 0;
                this.frame = 0;
                soundManager.play("bomb_explode", { volume: 0.9 });
                console.log("Бомба взорвалась!");
                this.doDamage();
            }
        } else if (this.state === "explosion") {
            this.timer += dt;

            if (this.timer >= this.explosionFrameDelay) {
                this.timer = 0;
                this.frame++;
                if (this.frame > 3) {
                    // конец взрыва
                    gameManager.kill(this);
                }
            }
        }
    },

    trigger() {
        if (this.state !== "idle") return;
        this.state = "armed";
        this.timer = 0;
        console.log("Бомба активирована, взрыв через 2 секунды...");
    },

    doDamage() {
        const radius = this.props.radius || 32;
        const damage = this.props.damage || 1;

        const cx = this.pos_x + this.size_x / 2;
        const cy = this.pos_y + this.size_y / 2;

        const player = gameManager.player;
        if (!player) return;

        const px = player.pos_x + player.size_x / 2;
        const py = player.pos_y + player.size_y / 2;

        const dx = px - cx;
        const dy = py - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist <= radius) {
            player.life -= damage;
            console.log("Игрок получил урон от взрыва. Жизни:", player.life);
        }
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            this.trigger();
        }
    }
});

let Coin = Entity.extend({
    type: "Coin",
    size_x: 16,
    size_t: 16,

    frame: 0,
    frameCounter: 0,
    frameDelay: 6,
    frames: ["coin_0", "coin_1", "coin_2", "coin_3", "coin_4", "coin_5"],

    update() {
        this.frameCounter++;
        if (this.frameCounter >= this.frameDelay) {
            this.frameCounter = 0;
            this.frame = (this.frame + 1) % this.frames.length;
        }
    },

    draw(ctx) {
        const sprite = this.frames[this.frame];
        spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
    },

    collect(player) {
        player.scores += 10;
        console.log("Монета! Счёт:", player.scores);
        soundManager.play("coin", { volume: 0.7 });
        gameManager.kill(this);
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            this.collect(other);
        }
    }
});

let SpikeTrap = Entity.extend({
    type: "SpikeTrap",
    size_x: 16,
    size_y: 16,

    state: "inactive", // inactive / active
    timer: 0,
    frame: 0,

    damageCooldown: 1500, // мс между ударами
    lastHitTime: 0,

    update() {
        const dt = 30; // как в игровом цикле
        this.timer += dt;

        const activeTime = this.props.activeTime || 1000;
        const inactiveTime = 3000; // this.props.inactiveTime || 2000;

        // переключаем состояние
        if (this.state === "inactive" && this.timer >= inactiveTime) {
            this.state = "active";
            this.timer = 0;
        } else if (this.state === "active" && this.timer >= activeTime) {
            this.state = "inactive";
            this.timer = 0;
        }

        // анимация: безопасные / опасные кадры
        let frames;
        let period;

        if (this.state === "inactive") {
            // спрятано
            frames = [0, 11];
            period = inactiveTime;
        } else {
            // вылезли
            frames = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
            period = activeTime;
        }

        const t = this.timer % period;
        const idx = Math.floor(t / period * frames.length);
        this.frame = frames[idx];

        // проверка столкновения с игроком каждый кадр
        const player = gameManager.player;
        if (player) {
            const spikeBox = physicManager.getHitBox(this);
            const playerBox = physicManager.getHitBox(player);

            if (physicManager.intersects(spikeBox, playerBox)) {
                this.onTouchEntity(player);
            }
        }
    },

    onTouchEntity(other) {
        if (other.type !== "Player") return;
        if (this.state !== "active") return;

        const now = performance.now ? performance.now() : Date.now();
        if (now - this.lastHitTime < this.damageCooldown) return;
        this.lastHitTime = now;

        const dmg = this.props.damage || 1;
        other.life -= dmg;
        console.log("Шипы: урон", dmg, "HP:", other.life);
    },

    draw(ctx) {
        const idxStr = this.frame.toString().padStart(2, "0");
        const sprite = "spikes_" + idxStr;

        const tilesWide = Math.max(1, Math.round(this.size_x / 16));
        for (let i = 0; i < tilesWide; i++) {
            spriteManager.drawSprite(ctx, sprite, this.pos_x + i * 16, this.pos_y);
        }
    }
});

let HealPotion = Entity.extend({
    type: "HealPotion",
    size_x: 16,
    size_y: 16,

    draw(ctx) {
        spriteManager.drawSprite(ctx, "red_potion", this.pos_x, this.pos_y);
    },

    heal(player) {
        player.life += 1;
        console.log("Зелье! Жизни:", player.life);
        gameManager.kill(this);
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            this.heal(other);
        }
    }
});

let Shuriken = Entity.extend({
    type: "Shuriken",
    size_x: 16,
    size_y: 16,
    speed: 4,
    dir_x: 0,
    dir_y: 0,

    frame: 0,
    frameTimer: 0,
    frameDelay: 4,

    hit: false, // уже кого-то зацепили

    create(x, y, direction) {
        const obj = Object.create(Shuriken);
        obj.size_x = 16;
        obj.size_y = 16;

        obj.pos_x = x;
        obj.pos_y = y;

        obj.hit = false;

        if (direction === "up") {
            obj.dir_x = 0; obj.dir_y = -1;
        } else if (direction === "down") {
            obj.dir_x = 0; obj.dir_y = 1;
        } else if (direction === "left") {
            obj.dir_x = -1; obj.dir_y = 0;
        } else if (direction === "right") {
            obj.dir_x = 1; obj.dir_y = 0;
        } else {
            obj.dir_x = 0; obj.dir_y = -1;
        }

        return obj;
    },

    update() {
        if (this.hit) return;

        this.move_x = this.dir_x;
        this.move_y = this.dir_y;

        physicManager.update(this);

        this.frameTimer++;
        if (this.frameTimer >= this.frameDelay) {
            this.frameTimer = 0;
            this.frame = (this.frame + 1) % 4;
        }
    },

    draw(ctx) {
        const sprite = "shuriken_" + this.frame;
        spriteManager.drawSprite(ctx, sprite, this.pos_x, this.pos_y);
    },

    onTouchMap(kind) {
        this.hit = true;
        gameManager.kill(this);
    },

    onTouchEntity(other) {
        if (this.hit) return;
        if (other.type === "Enemy") {
            this.hit = true;

            gameManager.kill(other);
            gameManager.kill(this);

            gameManager.player.scores += 50;
        }
    }
});

let Enemy = Entity.extend({
    type: "Enemy",
    size_x: 16,
    size_y: 16,

    // движение
    speed: 0.8,
    move_x: 0,
    move_y: 0,

    // анимация
    animFrame: 0,
    lastAnimTime: 0,
    animDelay: 100, // мс
    direction: "right", // "left" / "right"
    sprite: "spider_right_0",

    state: "patrol", // "patrol" или "chase"
    patrolStart: { x: 0, y: 0 },
    patrolEnd: { x: 0, y: 0 },
    patrolDir: 1, // 1 — к patrolEnd, -1 — к patrolStart

    init(tiledObj) {
        // стартовая точка патруля
        this.patrolStart = { x: this.pos_x, y: this.pos_y };

        // вторая точка из свойств Tiled
        const toX = tiledObj.properties?.find(p => p.name === "patrolToX")?.value || this.pos_x;
        const toY = tiledObj.properties?.find(p => p.name === "patrolToY")?.value || this.pos_y;

        this.patrolEnd = { x: toX, y: toY };

        // опциональные параметры
        if (this.props.speed) {
            this.speed = this.props.speed;
        }
        if (this.props.vision) {
            this.visionRadius = this.props.vision;
        }
        if (this.props.damage) {
            this.damage = this.props.damage;
        }
    },

    update() {
        const player = gameManager.player;
        if (!player) return;

        // расстояние до игрока
        const dx = player.pos_x - this.pos_x;
        const dy = player.pos_y - this.pos_y;
        const dist2 = dx * dx + dy * dy;

        const r2 = this.visionRadius * this.visionRadius;

        // переключаем состояния
        if (dist2 <= r2) {
            this.state = "chase";
        } else if (this.state === "chase" && dist2 > r2 * 1.5) {
            // если игрок далеко — возвращаемся к патрулю
            this.state = "patrol";
        }

        // выбираем поведение
        if (this.state === "chase") {
            // бежим к игроку
            const len = Math.hypot(dx, dy) || 1;
            this.move_x = (dx / len) * this.speed;
            this.move_y = (dy / len) * this.speed;
        } else {
            // патруль A <-> B
            const target = (this.patrolDir > 0) ? this.patrolEnd : this.patrolStart;
            const pdx = target.x - this.pos_x;
            const pdy = target.y - this.pos_y;
            const len = Math.hypot(pdx, pdy) || 1;

            if (len < 2) { // примерно достигли точки — разворачиваемся
                this.patrolDir *= -1;
                this.move_x = 0;
                this.move_y = 0;
            } else {
                this.move_x = (pdx / len) * this.speed;
                this.move_y = (pdy / len) * this.speed;
            }
        }

        // проверки столкновений
        physicManager.update(this);
        this.updateAnimation();
    },

    updateAnimation() {
        // если паук стоит, то кадр без анимации
        if (Math.abs(this.move_x) < 0.01 && Math.abs(this.move_y) < 0.01) {
            this.animFrame = 0;
            this.sprite = "spider_" + this.direction + "_0";
            return;
        }

        // определяем направление: по горизонтали
        if (this.move_x > 0.01) {
            this.direction = "right";
        } else if (this.move_x < -0.01) {
            this.direction = "left";
        }

        const now = performance.now();
        if (now - this.lastAnimTime > this.animDelay) {
            this.animFrame = (this.animFrame + 1) % 5; // 0..4
            this.lastAnimTime = now;
        }

        this.sprite = "spider_" + this.direction + "_" + this.animFrame;
    },

    onTouchEntity(other) {
        if (other.type === "Player") {
            other.life -= this.damage;
            console.log("Враг ударил игрока, жизнь:", other.life);
        }
    },

    draw(ctx) {
        spriteManager.drawSprite(ctx, this.sprite, this.pos_x, this.pos_y);
    }
});
