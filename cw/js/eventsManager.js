let eventsManager = {
    bind: [], // сопоставление клавиш действиям
    action: [], // действия

    setup() { // настройка сопоставления
        this.bind[87] = 'up'; // w
        this.bind[65] = 'left'; // a
        this.bind[83] = 'down'; // s
        this.bind[68] = 'right'; // d
        this.bind[32] = 'fire'; // пробел

        // контроль событий клавиатуры
        document.body.addEventListener("keydown", this.onKeyDown);
        document.body.addEventListener("keyup", this.onKeyUp);
    },

    onKeyDown: (event) => { // нажали на кнопку
        let action = eventsManager.bind[event.keyCode];
        if (action) {
            eventsManager.action[action] = true; // согласились выполнять
        }
    },

    onKeyUp: (event) => { // отпустили кнопку
        let action = eventsManager.bind[event.keyCode];
        if (action) {
            eventsManager.action[action] = false;
        }
    },

    clearActions() {
        this.action = [];
    }
};
