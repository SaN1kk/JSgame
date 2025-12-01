let soundManager = {
    clips: {},  // { name: { buffer, loaded } }
    context: null, // аудиоконтекст
    gainNode: null, // главный узел
    loaded: false,

    init() {
        this.context = new AudioContext();
        this.gainNode = this.context.createGain ? this.context.createGain() : this.context.createGainNode();
        this.gainNode.connect(this.context.destination); // подключение к динамикам
        this.gainNode.gain.value = 0.25; // общая громкость
    },

    load(name, path, onload) {
        if (!this.context) return;

        const request = new XMLHttpRequest();
        request.open("GET", path, true);
        request.responseType = "arraybuffer";

        request.onload = () => {
            this.context.decodeAudioData(request.response, (buffer) => {
                this.clips[name] = {
                    buffer: buffer,
                    loaded: true
                };
                if (onload) onload();
            }, (err) => {
                console.error("Ошибка decodeAudioData для", path, err);
            });
        };

        request.onerror = () => {
            console.error("Ошибка загрузки звука:", path);
        };

        request.send();
    },


    // загрузка набора звуков
    loadArray(list, callback) {
        if (!this.context || !list || !list.length) {
            if (callback) callback();
            return;
        }

        let loadCount = 0;
        const total = list.length;

        list.forEach(s => {
            this.load(s.name, s.path, () => {
                loadCount++;
                if (loadCount === total) {
                    this.loaded = true;
                    if (callback) callback();
                }
            });
        });
    },

    play(name, options = {}) {
        if (!this.context) return;

        const clip = this.clips[name];
        if (!clip || !clip.loaded) return;

        const source = this.context.createBufferSource();
        source.buffer = clip.buffer;

        let gainNode = this.context.createGain();
        gainNode.gain.value = (typeof options.volume === "number") ? options.volume : 1.0;

        source.connect(gainNode);
        gainNode.connect(this.gainNode);

        source.loop = !!options.loop;
        source.start(0);

        return source;
    }
};