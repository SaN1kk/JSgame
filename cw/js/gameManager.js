let hudManager = {
    hpEl: null,
    levelEl: null,
    scoreEl: null,
    silverEl: null,
    goldEl: null,

    init() {
        this.hpEl = document.getElementById("hud-hp");
        this.levelEl = document.getElementById("hud-level");
        this.scoreEl = document.getElementById("hud-score");
        this.silverEl = document.getElementById("hud-key-silver");
        this.goldEl = document.getElementById("hud-key-gold");
    },

    update(player, game) {
        if (!player || !this.hpEl) return;

        this.hpEl.textContent = player.life;
        this.levelEl.textContent = game.level;
        this.scoreEl.textContent = player.scores;
        this.silverEl.textContent = "S:" + (player.keys[1] ? 1 : 0);
        this.goldEl.textContent = "G:" + (player.keys[2] ? 1 : 0);
    }
};


let gameManager = {
    factory: {}, // фабрика объектов
    entities: [], // объекты на карте
    player: null, // указатель на объект игрока
    laterKill: [], // отложенное уничтожение объектов
    level: 1,
    gameOver: false,
    enemiesCleared: false, // убиты все враги

    ctx: null, // контекст
    lastTime: 0,
    deltaTime: 16,

    init(ctx, mapPath) {
        this.ctx = ctx;
        hudManager.init();
        soundManager.init();

        // набор звуков
        soundManager.loadArray([
            { name: "bg_level", path: "audio/bg_level.mp3" },
            { name: "bomb_explode", path: "audio/bomb_explosion.mp3" },
            { name: "shuriken", path: "audio/shuriken.mp3" },
            { name: "coin", path: "audio/coin.mp3" },
            { name: "lever", path: "audio/lever.mp3" },
            { name: "door_open", path: "audio/door_open.mp3" },
            { name: "chest_open", path: "audio/chest_open.mp3" },
        ], () => {
            if (this.level === 1 || this.level === 2) {
                soundManager.play("bg_level", { loop: true, volume: 0.5 });
            }
        });

        this.loadAll(mapPath);
    },

    initPlayer(obj) {
        this.player = obj;
    },

    loadRunStateFromStorage() {
        if (!this.player) return;

        const stateStr = localStorage.getItem("runState");
        if (stateStr) {
            try {
                const st = JSON.parse(stateStr);

                // очки
                if (typeof st.score === "number") {
                    this.player.scores = st.score;
                }

                // жизни
                if (typeof st.life === "number") {
                    this.player.life = st.life;
                }

                // ключи
                if (st.keys && typeof st.keys === "object") {
                    this.player.keys = st.keys;
                }

                return;
            } catch (e) {
                console.warn("Ошибка чтения runState из localStorage", e);
            }
        }
    },

    saveRunState() {
        if (!this.player) return;

        const state = {
            score: this.player.scores || 0,
            life: this.player.life,
            keys: this.player.keys
        };

        localStorage.setItem("runState", JSON.stringify(state));
        localStorage.setItem("runScore", String(state.score));
    },

    loadAll(mapPath) {
        mapManager.loadMap(mapPath);
        spriteManager.loadAtlas("/img/sprites/spritesheet.json", "/img/sprites/spritesheet.png");

        gameManager.factory["Player"] = Player;
        gameManager.factory["SilverKey"] = SilverKey;
        gameManager.factory["Chest"] = Chest;
        gameManager.factory["Bomb"] = Bomb;
        gameManager.factory["Door"] = Door;
        gameManager.factory["SpikeTrap"] = SpikeTrap;
        gameManager.factory["Lever"] = Lever;
        gameManager.factory["Coin"] = Coin;
        gameManager.factory["HealPotion"] = HealPotion;
        gameManager.factory["Shuriken"] = Shuriken;
        gameManager.factory["Enemy"] = Enemy;

        eventsManager.setup();

        const waitForLoad = () => {
            // ждём пока загрузится карта и атлас спрайтов
            if (!mapManager.jsonLoaded || !mapManager.imgLoaded) {
                requestAnimationFrame(waitForLoad);
                return;
            }

            mapManager.parseEntities();
            this.loadRunStateFromStorage();

            this.play();
        };

        waitForLoad();
    },


    kill(obj) {
        this.laterKill.push(obj);
    },

    update() {
        if (this.player === null) {
            return;
        }

        // по умолчанию игрок никуда не двигается
        this.player.move_x = 0;
        this.player.move_y = 0;

        if (eventsManager.action["up"]) this.player.move_y = -1;
        if (eventsManager.action["down"]) this.player.move_y = 1;
        if (eventsManager.action["left"]) this.player.move_x = -1;
        if (eventsManager.action["right"]) this.player.move_x = 1;

        if (eventsManager.action["fire"]) {
            this.player.fire();
        }

        // обновление информации по всем объектам на крте
        this.entities.forEach((e) => {
            try { // защита от ошибок при выполнении update
                e.update();
            } catch (ex) {
                console.log("Ошибка в update у объекта:", e, ex);
            }
        });

        // удаление всех объектов, попавших в laterKill
        for (let i = 0; i < this.laterKill.length; i++) {
            let idx = this.entities.indexOf(this.laterKill[i]);
            if (idx > -1) {
                this.entities.splice(idx, 1); // удаление из массива 1 объект
            }
        }

        if (this.laterKill.length > 0) { // очистка массива laterKill
            this.laterKill.length = 0;
        }

        // проверяем, остались ли враги
        this.checkEnemiesCleared();

        // проверка победы для второго уровня
        if (this.enemiesCleared && this.player) {
            const cx = this.player.pos_x + this.player.size_x / 2;
            const cy = this.player.pos_y + this.player.size_y / 2;

            if (cx >= 208 && cx <= 240 && cy >= 208 && cy <= 240 && gameManager.level === 2) {
                // игрок зашёл в квадрат со звёздочкой
                this.finishGame(true);
            }
        }

        if (this.player.life <= 0 && !this.gameOver) {
            this.finishGame(false);
            return;
        }

        hudManager.update(this.player, this);
    },

    finishGame(success) {
        if (this.gameOver) return;
        this.gameOver = true;

        const player = this.player;
        const currentScore = player ? (player.scores || 0) : 0;

        // проигрыш на любом уровне
        if (!success) {
            alert("Вы погибли!");

            if (player) {
                // записываем текущий результат как неуспешный
                recordsManager.addRecord(currentScore, false);
            }

            // полностью сбрасываем прогресс забега
            localStorage.removeItem("runScore");
            localStorage.removeItem("runState");

            window.location.href = "records.html";
            return;
        }

        // победа
        if (player) {
            player.scores = (player.scores || 0) + 100;
        }

        // на уровне 1
        if (this.level === 1) {
            this.saveRunState();

            alert("Поздравляем! Уровень 1 пройден.\n+100 очков за прохождение.");
            window.location.href = "level2.html";
            return;
        }

        // на уровне 2
        if (this.level === 2) {
            const finalScore = player ? (player.scores || 0) : 0;

            if (player) {
                // записываем финальный рекорд (оба уровня вместе)
                recordsManager.addRecord(finalScore, true);
            }

            // чистим прогресс забега
            localStorage.removeItem("runScore");
            localStorage.removeItem("runState");

            alert("Поздравляем! Вы прошли игру!\nИтоговый счёт: " + finalScore);
            window.location.href = "records.html";
        }
    },


    draw() { // отображение игрового поля пользователя
        mapManager.draw(this.ctx);

        // все сущности, кроме игрока
        for (let e of this.entities) {
            if (e === this.player) continue;
            e.draw(this.ctx);
        }

        // игрок сверху
        if (this.player) {
            this.player.draw(this.ctx);
        }
    },

    play() {
        this.lastTime = performance.now();

        const loop = (time) => {
            this.deltaTime = time - this.lastTime;
            this.lastTime = time;

            this.update();
            this.draw();

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    },

    checkEnemiesCleared() {
        if (this.enemiesCleared || gameManager.level === 1) return;

        // считаем врагов
        const hasEnemy = this.entities.some(e =>
            e.type === "Enemy"
        );

        if (!hasEnemy) {
            this.enemiesCleared = true;
            console.log("Все враги уничтожены, открываем центр лавы");
            mapManager.openCenterLavaArea();
        }
    },
};
