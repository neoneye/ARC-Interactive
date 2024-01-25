class PageController {
    constructor() {
        this.db = null;

        // Create URLSearchParams object
        const urlParams = new URLSearchParams(window.location.search);

        // Get the 'dataset' parameter
        const urlParamDataset = urlParams.get('dataset');

        // If 'dataset' parameter exists, decode it
        if (urlParamDataset) {
            const decodedDataset = decodeURIComponent(urlParamDataset);
            console.log("Dataset:", decodedDataset);
            this.datasetId = decodedDataset;
        } else {
            this.datasetId = 'ARC';
            // console.log("URLSearchParams does not contain 'dataset' parameter. Using 'ARC' dataset.");
        }

        document.title = this.datasetId;
    }

    async onload() {
        this.db = await DatabaseWrapper.create();
        // console.log('PageController.onload()', this.db);
        this.setupDatasetPicker();
        await this.loadTasks();
        // await this.loadNames();

        addEventListener("pagehide", (event) => {
            this.onbeforeunload();
        });

        // Restore scroll position
        // When the user moves to another page, and then clicks the back button, the page is scrolled to the original position.
        let key = this.scrollTopKey();
        let el = document.getElementById('main-inner');
        let rawValue = sessionStorage.getItem(key);
        if (typeof rawValue != 'undefined') {
            let value = parseInt(rawValue);
            if (value > 0) {
                el.scrollTop = value;
                console.log(`PageController.onload() Restored scroll position. key: ${key}. value: ${value}`);
            }
        }
    }

    onbeforeunload() {
        // console.log('PageController.onbeforeunload()');

        // Save scroll position in sessionStorage, so that we can restore it when the page is reloaded.
        // When the user moves to another page, and then clicks the back button, the page is scrolled to the original position.
        let key = this.scrollTopKey();
        let el = document.getElementById('main-inner');
        let scrollTop = el.scrollTop;
        let value = scrollTop.toString();
        sessionStorage.setItem(key, value);
        console.log(`PageController.onbeforeunload() Saved scroll position. key: ${key}. value: ${value}`);
    }

    scrollTopKey() {
        var pathName = document.location.pathname;
        // console.log('PageController.scrollTopKey() pathName:', pathName);
        if (pathName == '/index.html') {
            // console.log('PageController.scrollTopKey() pathName is index.html. Setting to /');
            pathName = '/';
        }
        let key = "scrollTop_" + pathName;
        return key;
    }

    setupDatasetPicker() {
        var select = document.getElementById('select-dataset');

        // Set the selected option in the dropdown
        select.value = this.datasetId;

        // Listen for changes to the selected option
        select.addEventListener('change', () => {
            window.location.href = `index.html?dataset=${encodeURIComponent(select.value)}`;
        });
    }

    async loadNames() {
        console.log('PageController.loadNames()');
        let names = [
            '0a0a50ad',
            '0a0ac772',
            '0a0adaff',
        ];

        let new_names = [];
        for (let i = 0; i < 1; i += 1) {
            new_names = new_names.concat(names);
        }
        names = new_names;

        let tasks = [];
        for (let name of names) {
            try {
                let openUrl = `http://127.0.0.1:8090/task/${name}`
                let thumbnailCacheId = `task_thumbnail_${name}`
                let response = await fetch(`dataset/${name}.json`);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                let jsonData = await response.json();
                let task = new ARCTask(jsonData, openUrl, thumbnailCacheId);
                tasks.push(task);
            } catch (error) {
                console.error("Error loading task:", name, error);
            }
        }

        console.log('Loaded tasks:', tasks.length);
        await this.renderTasks(tasks);
        await this.showTasks(tasks);
    }

    async loadTasks() {
        console.log('PageController.loadTasks()');
        try {
            let dataset = await Dataset.load(this.db, this.datasetId);

            // Render thumbnails
            await this.renderTasks(dataset.tasks);

            await this.showTasks(dataset.tasks);
        } catch (error) {
            console.error('Error loading bundle', error);
        }
    }

    async renderTasks(tasks) {
        let time0 = Date.now();
        console.log('Render tasks:', tasks.length);

        var count_hit = 0;
        var count_miss = 0;
        for (let i = 0; i < tasks.length; i++) {
            let task = tasks[i];

            let dataURL = await this.dataURLForTaskThumbnailIfCached(task);
            if (dataURL != null) {
                // console.log('Rendering task - already cached', task.id);
                count_hit += 1;
                continue;
            }
            // console.log('Rendering task', task.id);
            await this.renderTaskThumbnailToCache(task);
            count_miss += 1;
        }

        let time1 = Date.now();
        console.log(`Render tasks. elapsed: ${time1 - time0} ms. Hit: ${count_hit}. Miss: ${count_miss}.`);
    }

    hideDemo() {
        document.getElementById('demo1').hidden = true;
        document.getElementById('demo2').hidden = true;
        document.getElementById('demo3').hidden = true;
    }

    hideOverlay() {
        document.getElementById("overlay").style.display = "none";
    }

    async renderTaskThumbnailToCache(task) {
        if (!(task instanceof ARCTask)) {
            throw new Error(`task is not an instance of ARCTask. task: ${task}`);
        }
        let count = task.train.length + task.test.length;
        let extraWide = (count > 6);
        let canvas = task.toThumbnailCanvas(extraWide, 1);

        await this.db.setImageFromCanvas(task.thumbnailCacheId, canvas);
    }

    async dataURLForTaskThumbnailIfCached(task) {
        if (!(task instanceof ARCTask)) {
            throw new Error(`task is not an instance of ARCTask. task: ${task}`);
        }
        let thumbnailCacheId = task.thumbnailCacheId;
        var image = null;
        try {
            // console.log('Loading image', thumbnailCacheId);
            image = await this.db.getImage(thumbnailCacheId);
        } catch (error) {
            console.error(`Error loading image ${thumbnailCacheId}`, error);
            return null;
        }
        if (image == null) {
            // console.log(`The image is not present in the cache. ${thumbnailCacheId}`);
            return null;
        }

        // console.log('image', image);
        let dataURL = URL.createObjectURL(image);
        return dataURL;
    }

    async dataURLForTaskThumbnail(task) {
        if (!(task instanceof ARCTask)) {
            throw new Error(`task is not an instance of ARCTask. task: ${task}`);
        }
        let dataURL = await this.dataURLForTaskThumbnailIfCached(task);
        if (dataURL != null) {
            return dataURL;
        }
        await this.renderTaskThumbnailToCache(task);
        dataURL = await this.dataURLForTaskThumbnailIfCached(task);
        return dataURL;
    }

    async showTasks(tasks) {
        console.log('Show tasks:', tasks.length);
        this.hideDemo();

        for (let i = 0; i < tasks.length; i++) {
            let task = tasks[i];

            let count = task.train.length + task.test.length;
            let extraWide = (count > 6);

            let dataURL = await this.dataURLForTaskThumbnail(task);
            if (!dataURL) {
                console.error(`The dataURL is null. Error loading image ${task.thumbnailCacheId}`);
                continue;
            }
                    
            // let canvas = task.toThumbnailCanvas(extraWide, 1);
            // let canvas = task.toCanvas(5, extraWide);
            // dataURL = canvas.toDataURL();
    
            const el_img = document.createElement('img');
            el_img.className = 'gallery__img';
    
            const el_a = document.createElement('a');
            if (extraWide) {
                el_a.className = `gallery__item gallery__item__wide`;
            } else {
                el_a.className = 'gallery__item gallery__item__normal';
            }
            el_a.href = task.openUrl;
            el_a.appendChild(el_img);
    
            const el_gallery = document.getElementById('gallery');
            el_gallery.appendChild(el_a);
    
            el_img.src = dataURL;
        }

        this.hideOverlay();
    }

    flushIndexedDB() {
        const openRequest = indexedDB.open(indexdb_database_name, 1);

        openRequest.onsuccess = function() {
            let db = openRequest.result;
            let transaction = db.transaction('images', 'readwrite');
            let images = transaction.objectStore('images');
            let request = images.clear();

            request.onsuccess = function() {
                console.log("IndexedDB flushed");
            };

            request.onerror = function() {
                console.log("Error", request.error);
            };
        };
    }
}

var gPageController = null;
  
function body_onload() {
    gPageController = new PageController();
    (async () => {
        gPageController.onload();
    })();
}
