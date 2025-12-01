let physicManager = {
    // хитбокс объекта
    getHitBox(obj, newPosX = obj.pos_x, newPosY = obj.pos_y) {
        const hit_x = obj.hit_x || 0;
        const hit_y = obj.hit_y || 0;
        const hit_w = obj.hit_w || obj.size_x;
        const hit_h = obj.hit_h || obj.size_y;

        return {
            x: newPosX + hit_x,
            y: newPosY + hit_y,
            w: hit_w,
            h: hit_h
        };
    },

    // блокирующий хитбокс для объектов
    getBlockBox(obj) {
        if (obj.block_w && obj.block_h) {
            const bx = obj.block_x || 0;
            const by = obj.block_y || 0;
            return {
                x: obj.pos_x + bx,
                y: obj.pos_y + by,
                w: obj.block_w,
                h: obj.block_h
            };
        }
        return null;
    },

    // пересечение прямоугольников
    intersects(a, b) {
        return !(
            a.x + a.w <= b.x ||
            a.x >= b.x + b.w ||
            a.y + a.h <= b.y ||
            a.y >= b.y + b.h
        );
    },

    update(obj) {
        if (!obj.move_x && !obj.move_y) return;

        const speed = obj.speed || 0;
        const newPosX = obj.pos_x + obj.move_x * speed;
        const newPosY = obj.pos_y + obj.move_y * speed;

        const box = this.getHitBox(obj, newPosX, newPosY);

        // вылет за пределы карты
        if (mapManager.isOutOfBounds(box.x, box.y, box.w, box.h)) {
            if (obj.type === "Shuriken") {
                gameManager.kill(obj);
                return;
            }
            if (obj.onTouchMap) obj.onTouchMap("border");
            return;
        }

        // стены и лава
        const points = [
            { x: box.x + 1, y: box.y + 1 },
            { x: box.x + box.w - 1, y: box.y + 1 },
            { x: box.x + 1, y: box.y + box.h - 1 },
            { x: box.x + box.w - 1, y: box.y + box.h - 1 }
        ];

        let blocked = false;
        let lavaHit = false;

        for (let p of points) {
            const tileIdx = mapManager.getTilesetIdx(p.x, p.y);
            const isLava = mapManager.isLava(p.x, p.y);

            if (tileIdx !== 0 || isLava) {
                blocked = true;
                if (isLava) lavaHit = true;
                break;
            }
        }

        if (blocked) {
            if (obj.type === "Shuriken") {
                // сюрикен врезался в стену/лаву, то уничтожаем
                gameManager.kill(obj);
                return;
            }
            if (obj.onTouchMap) obj.onTouchMap(lavaHit ? "lava" : "wall");
            return;
        }

        // столкновения с сущностями
        let blockedByEntity = false;

        for (let i = 0; i < gameManager.entities.length; i++) {
            const e = gameManager.entities[i];
            if (e === obj) continue;

            // триггеры по хитбоксу объекта
            const eBox = this.getHitBox(e);
            if (this.intersects(box, eBox)) {
                if (obj.onTouchEntity) obj.onTouchEntity(e);
                if (e.onTouchEntity) e.onTouchEntity(obj);
            }

            // блокирующие зоны (block_*)
            const bBox = this.getBlockBox(e);
            if (!bBox) continue;

            if (this.intersects(box, bBox)) {
                if (obj.type === "Shuriken") {
                    // сюрикен попал именно в block_* — уничтожаем
                    gameManager.kill(obj);
                    return;
                } else {
                    blockedByEntity = true;
                }
            }
        }

        if (blockedByEntity) {
            // для игрока — не двигаемся дальше
            return;
        }

        // всё ок, двигаем объект
        obj.pos_x = newPosX;
        obj.pos_y = newPosY;
    }
};
