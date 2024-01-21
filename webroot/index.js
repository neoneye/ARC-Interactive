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
        this.db = await initializeDatabase();
        console.log('PageController.onload()', this.db);
        this.setupDatasetPicker();
        await this.loadTasks();
        // await this.loadNames();
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

        let storedUTCTimestamp = localStorage.getItem('lastFetchedUTCTimestamp');
        console.log("JSON was fetched at UTC timestamp:", storedUTCTimestamp);

        let datasetId = this.datasetId;
        try {
            let cachedData = await fetchData(this.db, datasetId);
            if (!cachedData) {
                console.log('No cached data. Fetching');

                // Fetch and decompress data if not in cache
                const response = await fetch(`dataset/${datasetId}.json.gz`);
                const arrayBuffer = await response.arrayBuffer();
                const decompressed = pako.inflate(new Uint8Array(arrayBuffer), { to: 'string' });
                console.log('decompressed.length', decompressed.length);
                const jsonData = JSON.parse(decompressed);
    
                // Store in IndexedDB
                await storeData(this.db, datasetId, jsonData);
                
                // Update timestamp
                let utcTimestamp = Date.now();
                localStorage.setItem('lastFetchedUTCTimestamp', utcTimestamp.toString());
    
                let tasks = this.processData(jsonData);

                // Render thumbnails
                await this.renderTasks(tasks);

                await this.showTasks(tasks);
            } else {
                console.log('Using cached data');
                let tasks = this.processData(cachedData);
                await this.showTasks(tasks);
            }
        } catch (error) {
            console.error('Error loading bundle', error);
        }
    }

    processData(jsonData) {
        console.log('processData called');

        let tasks = [];
        for (let key of Object.keys(jsonData)) {
            let dict = jsonData[key];
            let taskId = dict.id;
            let encodedId = encodeURIComponent(taskId);
            let openUrl = `edit.html?dataset=${this.datasetId}&task=${encodedId}`;
            let thumbnailCacheId = `task_thumbnail_${this.datasetId}_${taskId}`;
            let task = new ARCTask(dict, openUrl, thumbnailCacheId);
            tasks.push(task);
        }
        console.log('Loaded tasks:', tasks.length);

        return tasks;
    }

    async renderTasks(tasks) {
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
        console.log(`Render tasks. Hit: ${count_hit}. Miss: ${count_miss}`);
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

        await storeCanvas(this.db, canvas, task.thumbnailCacheId);
    }

    async dataURLForTaskThumbnailIfCached(task) {
        if (!(task instanceof ARCTask)) {
            throw new Error(`task is not an instance of ARCTask. task: ${task}`);
        }
        let thumbnailCacheId = task.thumbnailCacheId;
        var image = null;
        try {
            // console.log('Loading image', thumbnailCacheId);
            image = await fetchImage(this.db, thumbnailCacheId);
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
        localStorage.removeItem('lastFetchedUTCTimestamp');

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
