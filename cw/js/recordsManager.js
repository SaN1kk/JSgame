const recordsManager = {
    storageKey: "dungeon_records",
    currentNameKey: "dungeon_player_name",
    lastRecordKey: "dungeon_last_record",

    setCurrentName(name) {
        localStorage.setItem(this.currentNameKey, name);
    },

    getCurrentName() {
        return localStorage.getItem(this.currentNameKey) || "Unknown";
    },

    getRecords() {
        const raw = localStorage.getItem(this.storageKey);
        if (!raw) return [];
        try {
            return JSON.parse(raw);
        } catch (e) {
            console.error("Ошибка чтения рекордов:", e);
            return [];
        }
    },

    saveRecords(list) {
        localStorage.setItem(this.storageKey, JSON.stringify(list));
    },

    addRecord(score, success) {
        const name = this.getCurrentName();
        let records = this.getRecords();

        const newRecord = {
            name,
            score,
            success,
            date: new Date().toISOString()
        };

        // ищем существующую запись по имени
        const idx = records.findIndex(r => r.name === name);

        if (idx === -1) {
            // записи ещё нет — добавляем
            records.push(newRecord);
            localStorage.setItem(this.lastRecordKey, JSON.stringify(newRecord));
        } else {
            const old = records[idx];
            // обновляем только если новый результат лучше
            if (score > old.score) {
                records[idx] = newRecord;
                localStorage.setItem(this.lastRecordKey, JSON.stringify(newRecord));
            } else {
                localStorage.setItem(this.lastRecordKey, JSON.stringify(old));
            }
        }

        // сортировка по убыванию очков
        records.sort((a, b) => b.score - a.score);

        this.saveRecords(records);
    },


    getLastRecord() {
        const raw = localStorage.getItem(this.lastRecordKey);
        if (!raw) return null;
        try {
            return JSON.parse(raw);
        } catch (e) {
            return null;
        }
    }
};
