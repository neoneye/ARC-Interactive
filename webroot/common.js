const indexdb_database_name = 'ARCDatabase';
const indexdb_store_name_image = 'image';
const indexdb_store_name_other = 'other';
const thumbnail_max_train_count = 6;
    

function initializeDatabase() {
    return new Promise((resolve, reject) => {
        const openRequest = indexedDB.open(indexdb_database_name, 7);

        openRequest.onupgradeneeded = function(event) {
            const db = event.target.result;

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(indexdb_store_name_image)) {
                db.createObjectStore(indexdb_store_name_image, { keyPath: 'id' });
            }

            // Create object store if it doesn't exist
            if (!db.objectStoreNames.contains(indexdb_store_name_other)) {
                db.createObjectStore(indexdb_store_name_other, { keyPath: 'id' });
            }
        };

        openRequest.onerror = function() {
            console.error("Error opening database:", openRequest.error);
            reject(openRequest.error);
        };

        openRequest.onsuccess = function() {
            resolve(openRequest.result);
        };
    });
}

async function storeData(db, id, data) {
    let storeName = indexdb_store_name_other;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readwrite");
        const store = transaction.objectStore(storeName);
        store.put({ id: id, data: data });

        transaction.oncomplete = () => resolve();
        transaction.onerror = event => reject("IndexedDB write error: " + event.target.errorCode);
    });
}

async function fetchData(db, id) {
    let storeName = indexdb_store_name_other;
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, "readonly");
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result ? request.result.data : null);
        request.onerror = event => reject("IndexedDB read error: " + event.target.errorCode);
    });
}

async function storeCanvas(db, canvas, id) {
    // Convert canvas to blob
    const blob = await new Promise((resolve) => canvas.toBlob(resolve));

    // Perform the transaction
    return new Promise((resolve, reject) => {
        let transaction = db.transaction(indexdb_store_name_image, 'readwrite');
        let images = transaction.objectStore(indexdb_store_name_image);
        let request = images.put({ id: id, image: blob });

        request.onsuccess = function() {
            // console.log("Image saved to DB");
            resolve(request.result);
        };

        request.onerror = function() {
            console.log("Error", request.error);
            reject(request.error);
        };
    });
}


async function fetchImage(db, id) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(indexdb_store_name_image, "readonly");
        const store = transaction.objectStore(indexdb_store_name_image);
        const request = store.get(id);

        request.onsuccess = () => resolve(request.result ? request.result.image : null);
        request.onerror = event => reject("IndexedDB read error: " + event.target.errorCode);
    });
}

class DatabaseWrapper {
    constructor(indexedDBInstance) {
        this.indexedDBInstance = indexedDBInstance;
    }

    static async create() {
        let indexedDBInstance = await initializeDatabase();
        return new DatabaseWrapper(indexedDBInstance);
    }

    async getData(key) {
        // console.log('DatabaseWrapper.getData()', key);
        return await fetchData(this.indexedDBInstance, key);
    }

    async setData(key, data) {
        // console.log('DatabaseWrapper.setData()', key);
        await storeData(this.indexedDBInstance, key, data);
    }

    async getImage(key) {
        // console.log('DatabaseWrapper.getImage()', key);
        return await fetchImage(this.indexedDBInstance, key);
    }

    async setImageFromCanvas(key, canvas) {
        // console.log('DatabaseWrapper.setImageFromCanvas()', key);
        await storeCanvas(this.indexedDBInstance, canvas, key);
    }
}

class Dataset {
    constructor(datasetId, tasks) {
        this.datasetId = datasetId;
        this.tasks = tasks;
    }

    static async load(database, datasetId) {
        if (!(database instanceof DatabaseWrapper)) {
            throw new Error(`database is not an instance of DatabaseWrapper. database: ${database}`);
        }

        let time0 = Date.now();

        let uint8Array = await Dataset.fetchDatasetJsonGz(database, datasetId);

        
        // Decompress data
        
        let time1 = Date.now();
        var jsonData = null;
        console.log('will decompress uint8Array.length', uint8Array.length);
        try {
            // Attempt to parse the data directly
            let text = new TextDecoder().decode(uint8Array);
            jsonData = JSON.parse(text);
            console.log('Data is already a json string, decompression not needed.');
        } catch (error) {
            // Data might be compressed, attempt to decompress
            let decompressed = pako.inflate(uint8Array, { to: 'string' });
            console.log('decompressed.length', decompressed.length);
            jsonData = JSON.parse(decompressed);
            console.log('Successfully decompressed json data');
        }

        let time2 = Date.now();

        // Extract tasks
        let tasks = Dataset.tasksFromJsonData(jsonData, datasetId);

        let time3 = Date.now();
        console.log(`Dataset.load() elapsed ${time3 - time0} ms. Fetch: ${time1 - time0} ms. Decompress: ${time2 - time1} ms. Tasks from json: ${time3 - time2} ms.`);

        return new Dataset(datasetId, tasks);
    }

    // Return cached data if available. Fetch data if not in cache.
    static async fetchDatasetJsonGz(database, datasetId) {
        if (!(database instanceof DatabaseWrapper)) {
            throw new Error(`database is not an instance of DatabaseWrapper. database: ${database}`);
        }

        // Increment this counter to force invalidating the cache, so new data can be fetched
        let cacheBustingCounter = 13;
        let cacheKey = `dataset_${datasetId}_json_gz_${cacheBustingCounter}`;
        let cachedData = await database.getData(cacheKey);
        if (cachedData) {
            console.log(`Using cached dataset. Key: ${cacheKey} Length: ${cachedData.length}`);
            return new Uint8Array(cachedData);
        }
        console.log('No cached dataset. Will fetch now.');

        // Fetch data if not in cache
        let url = `dataset/${datasetId}.json.gz`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch dataset. Status: ${response.status} url: ${url}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        let uint8Array = new Uint8Array(arrayBuffer);
        console.log('Did fetch dataset.');

        // Store in IndexedDB
        await database.setData(cacheKey, uint8Array);
        console.log(`Saved dataset to cache. Key: ${cacheKey} Length: ${uint8Array.length}`);
        return uint8Array;
    }

    static tasksFromJsonData(jsonData, datasetId) {
        let tasks = [];
        for (let key of Object.keys(jsonData)) {
            let taskJsonData = jsonData[key];
            let taskId = taskJsonData.id;
            let task = new ARCTask(datasetId, taskId, taskJsonData);
            tasks.push(task);
        }
        console.log('Loaded tasks:', tasks.length);
        return tasks;
    }

    findTask(taskId) {
        console.log(`findTask taskId: ${taskId}`);
        for (let task of this.tasks) {
            if (task.jsonData.id == taskId) {
                return task;
            }
        }
        return null;
    }
}

class Theme {
    constructor(palette) {
        if (palette.length !== 10) {
            throw new Error(`Palette must have 10 colors. Length: ${palette.length}`);
        }
        this.palette = palette;
    }

    getColorString(index) {
        return this.palette[index];
    }

    static originalARCPalette() {
        return [
            "#000000", // 0 = black
            "#0074d9", // 1 = blue
            "#ff4136", // 2 = red
            "#2ecc40", // 3 = green
            "#ffdc00", // 4 = yellow
            "#aaaaaa", // 5 = gray
            "#f012be", // 6 = fuchsia
            "#ff851b", // 7 = orange
            "#7fdbff", // 8 = teal
            "#870c25", // 9 = brown
        ];
    }

    static themeFromBody() {
        // Get the computed style of the <body> element or the element you applied the variable to
        const style = getComputedStyle(document.body);
    
        let palette = Theme.originalARCPalette();

        // Get the value of --arc-color-0, --arc-color-1, ..., --arc-color-9.
        for (let i = 0; i <= 9; i++) {
            const color = style.getPropertyValue(`--arc-color-${i}`).trim(); // .trim() to remove any potential blank spaces
            palette[i] = color;
        }

        return new Theme(palette);
    }

    // Load the selected theme from local storage.
    static getThemeRaw() {
        return localStorage.getItem('theme');
    }

    // Load the selected theme from local storage, and sanity check that it's among the available themes.
    // If the theme is not among the available themes, then switch to the theme, named "default"
    static getTheme() {
        let theme = Theme.getThemeRaw();
        if (theme == null) {
            theme = "default";
        }
        let availableThemes = Theme.getAvailableThemes();
        if (!availableThemes.includes(theme)) {
            theme = "default";
        }
        return theme;
    }

    // Save the selected theme to local storage
    static setTheme(theme) {
        localStorage.setItem('theme', theme);
    }

    static getAvailableThemes() {
        return ["default", "paultolmuted", "paultolsequential", "bluecyanwhite", "greyscale", "c64", "secam", "ega", "amigaworkbench13", "applerainbow", "romanfresco"];
    }

    // Assign the theme to the <body> element.
    static assignBodyClassName() {
        let theme = Theme.getTheme();
        var body = document.getElementsByTagName('body')[0];
        body.className = `theme-${theme}`;
    }
}

class ARCImage {
    constructor(pixels) {
        var min_length = 1000000;
        var max_length = 0;
        for (let row of pixels) {
            min_length = Math.min(min_length, row.length);
            max_length = Math.max(max_length, row.length);
        }
        if (min_length !== max_length) {
            throw new Error(`Image is not rectangular: min_length=${min_length}, max_length=${max_length}`);
        }
        this.pixels = pixels;
        this.width = min_length;
        this.height = pixels.length;
    }

    static color(width, height, color) {
        if (width < 1 || height < 1 || width > 255 || height > 255) {
            throw new Error(`Image size must be between 1x1 and 255x255: width=${width}, height=${height}`);
        }
        if (color < 0 || color > 255) {
            throw new Error(`Pixel color must be between 0 and 255: color=${color}`);
        }
        var pixels = [];
        for (var y = 0; y < height; y++) {
            var row = [];
            for (var x = 0; x < width; x++) {
                row.push(color);
            }
            pixels.push(row);
        }
        return new ARCImage(pixels);
    }

    clone() {
        let pixels = JSON.parse(JSON.stringify(this.pixels));
        return new ARCImage(pixels);
    }

    isEqualTo(other) {
        if (!(other instanceof ARCImage)) {
            throw new Error("ARCImage.isEqual() 'other' is not an instance of ARCImage");
        }
        let s0 = JSON.stringify(this.pixels);
        let s1 = JSON.stringify(other.pixels);
        return s0 === s1;
    }

    toCanvas(theme, devicePixelRatio) {
        let cellSize = 1;
        let gapSize = 0;
        return this.toCanvasWithCellSize(theme, devicePixelRatio, cellSize, gapSize);
    }
    
    toCanvasWithStyle(theme, devicePixelRatio, cellSize, showGrid) {
        if(showGrid) {
            return this.toCanvasWithGridAndBorder(theme, devicePixelRatio, cellSize);
        }
        return this.toCanvasWithCellSize(theme, devicePixelRatio, cellSize, 0);
    }

    toCanvasWithCellSize(theme, devicePixelRatio, cellSize, gapSize) {
        let sizeWidth = this.width * cellSize - gapSize;
        let sizeHeight = this.height * cellSize - gapSize;

        let canvas = document.createElement('canvas');

        // Set the 'drawing buffer' size.
        canvas.width = sizeWidth * devicePixelRatio;
        canvas.height = sizeHeight * devicePixelRatio;

        // Set the 'display' size.
        canvas.style.width = sizeWidth + 'px';
        canvas.style.height = sizeHeight + 'px';

        let ctx = canvas.getContext('2d');

        // Scale the drawing context so shapes aren't stretched.
        ctx.scale(devicePixelRatio, devicePixelRatio);

        for (let y = 0; y < this.height; y += 1) {
            for (let x = 0; x < this.width; x += 1) {
                let pixel = this.pixels[y][x];
                ctx.fillStyle = theme.getColorString(pixel);
                ctx.fillRect(x * cellSize, y * cellSize, cellSize - gapSize, cellSize - gapSize);
            }
        }
        return canvas;
    }

    toCanvasWithGridAndBorder(theme, devicePixelRatio, cellSize) {
        let canvasInner = this.toCanvasWithGridAndBorderInner(theme, cellSize * devicePixelRatio);
        if (devicePixelRatio === 1) {
            return canvasInner;
        }

        // Some devices have a devicePixelRatio of 2 or 3.
        // We always want the grid size to be 1 pixel, also on these high resolution devices.
        // Thus don't scale the drawing context so shapes have to be stretched.

        // Round up to the nearest integer value, otherwise the canvas will be blurry in some browsers.
        let width = Math.ceil(canvasInner.width / devicePixelRatio);
        let height = Math.ceil(canvasInner.height / devicePixelRatio);
        
        let canvas = document.createElement('canvas');

        // Set the 'drawing buffer' size.
        canvas.width = width * devicePixelRatio;
        canvas.height = height * devicePixelRatio;

        // Set the 'display' size.
        canvas.style.width = width + 'px';
        canvas.style.height = height + 'px';

        let ctx = canvas.getContext('2d');
        ctx.drawImage(canvasInner, 0, 0);
        return canvas;
    }

    toCanvasWithGridAndBorderInner(theme, cellSize) {
        let borderSize = 1;
        let gapSize = 1;
        let sizeWidth = this.width * cellSize - gapSize + borderSize * 2;
        let sizeHeight = this.height * cellSize - gapSize + borderSize * 2;

        let canvas = document.createElement('canvas');
        canvas.width = sizeWidth;
        canvas.height = sizeHeight;

        let ctx = canvas.getContext('2d');
        ctx.fillStyle = '#555';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let y = 0; y < this.height; y += 1) {
            for (let x = 0; x < this.width; x += 1) {
                let pixel = this.pixels[y][x];
                ctx.fillStyle = theme.getColorString(pixel);
                ctx.fillRect(
                    x * cellSize + borderSize, 
                    y * cellSize + borderSize, 
                    cellSize - gapSize, 
                    cellSize - gapSize
                );
            }
        }
        return canvas;
    }
    
    cellSize(width, height) {
        let cellX = width / this.width;
        let cellY = height / this.height;
        return Math.floor(Math.min(cellX, cellY));
    }

    // Left position of the image
    calcX0(drawX, width, cellSize) {
        let innerWidth = cellSize * this.width;
        return Math.floor(drawX + (width - innerWidth) / 2);
    }

    // Top position of the image
    calcY0(drawY, height, cellSize) {
        let innerHeight = cellSize * this.height;
        return Math.floor(drawY + (height - innerHeight) / 2);
    }

    draw(theme, ctx, drawX, drawY, width, height, cellSize, options) {
        let x0 = this.calcX0(drawX, width, cellSize);
        var y0 = this.calcY0(drawY, height, cellSize);
        if (options.alignTop) {
            y0 = drawY;
        }
        if (options.alignBottom) {
            let innerHeight = cellSize * this.height;
            y0 = drawY + height - innerHeight;
        }
        var gapSize = 0;
        if (options.gapSize) {
            gapSize = options.gapSize;
        }
        this.drawInner(theme, ctx, x0, y0, cellSize, gapSize);
    }

    drawInner(theme, ctx, x0, y0, cellSize, gapSize) {
        let cellSizeCeilInt = Math.ceil(cellSize) - gapSize;
        for (let y = 0; y < this.height; y += 1) {
            for (let x = 0; x < this.width; x += 1) {
                let pixel = this.pixels[y][x];
                ctx.fillStyle = theme.getColorString(pixel);
                ctx.fillRect(Math.floor(x0 + (x * cellSize)), Math.floor(y0 + (y * cellSize)), cellSizeCeilInt, cellSizeCeilInt);
            }
        }
    }

    // Change color of a single pixel
    setPixel(x, y, color) {
        if (color < 0 || color > 11) {
            throw new Error(`Invalid color: ${color}`);
        }
        if (this.pixels[y] === undefined || this.pixels[y][x] === undefined) {
            throw new Error(`Invalid setPixel coordinates: (${x}, ${y})`);
        }
        this.pixels[y][x] = color;
    }

    // Extract a sub-image from the image
    crop(x, y, width, height) {
        if (width < 1 || height < 1) {
            throw new Error(`Invalid crop: size must be 1x1 or bigger. width=${width}, height=${height}`);
        }
        if (x < 0 || y < 0 || x + width > this.width || y + height > this.height) {
            throw new Error(`Invalid crop: rectangle goes outside the image. x=${x}, y=${y}, width=${width}, height=${height}`);
        }
        let pixels = [];
        for (let i = 0; i < height; i++) {
            pixels.push(this.pixels[y + i].slice(x, x + width));
        }
        return new ARCImage(pixels);
    }

    // Reverse the image horizontally
    flipX() {
        let pixels = [];
        for (var y = 0; y < this.height; y++) {
            var row = [];
            for (var x = this.width - 1; x >= 0; x--) {
                row.push(this.pixels[y][x]);
            }
            pixels.push(row);
        }
        return new ARCImage(pixels);
    }

    // Reverse the image vertically
    flipY() {
        let pixels = [];
        for (var y = this.height - 1; y >= 0; y--) {
            pixels.push(this.pixels[y].slice());
        }
        return new ARCImage(pixels);
    }

    // Overlay another image on top of this image
    overlay(other_image, x, y) {
        let pixels = [];
        for (let i = 0; i < this.height; i++) {
            pixels.push(this.pixels[i].slice());
        }
        for (let i = 0; i < other_image.height; i++) {
            for (let j = 0; j < other_image.width; j++) {
                let yi = y + i;
                let xj = x + j;
                if (yi >= 0 && yi < this.height && xj >= 0 && xj < this.width) {
                    pixels[yi][xj] = other_image.pixels[i][j];
                }
            }
        }
        return new ARCImage(pixels);
    }

    // Rotate the image 90 degrees clockwise
    rotateCW() {
        let pixels = [];
        for (var x = 0; x < this.width; x++) {
            var row = [];
            for (var y = this.height - 1; y >= 0; y--) {
                row.push(this.pixels[y][x]);
            }
            pixels.push(row);
        }
        return new ARCImage(pixels);
    }

    // Rotate the image 90 degrees counter-clockwise
    rotateCCW() {
        return this.rotateCW().rotateCW().rotateCW();
    }

    // Flood fill the image with a new color
    floodFill(x, y, targetColor) {
        // Helper function for the flood fill algorithm
        const floodFillHelper = (x, y, sourceColor, targetColor) => {
            if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
                return;
            }
            let value = this.pixels[y][x];
            if (value === targetColor || value !== sourceColor) {
                return;
            }
            this.pixels[y][x] = targetColor;
            floodFillHelper(x - 1, y, sourceColor, targetColor);
            floodFillHelper(x + 1, y, sourceColor, targetColor);
            floodFillHelper(x, y - 1, sourceColor, targetColor);
            floodFillHelper(x, y + 1, sourceColor, targetColor);
        };
    
        // Check if coordinates are within bounds
        if (x < 0 || x >= this.width || y < 0 || y >= this.height) {
            return;
        }
    
        // Get the source color and start the flood fill
        let sourceColor = this.pixels[y][x];
        floodFillHelper(x, y, sourceColor, targetColor);
    }
    
    // Move the content to the left inside the rectangle, wrap around when reaching the left edge.
    moveLeft(x, y, width, height) {
        var image3 = this.clone();
        if (width >= 2) {
            let image0 = this.crop(x, y, 1, height);
            let image1 = this.crop(x + 1, y, width - 1, height);
            let image2 = this.overlay(image1, x, y);
            image3 = image2.overlay(image0, x + width - 1, y);
        }
        return image3;
    }
    
    // Move the content to the right inside the rectangle, wrap around when reaching the right edge.
    moveRight(x, y, width, height) {
        var image3 = this.clone();
        if (width >= 2) {
            let image0 = this.crop(x + width - 1, y, 1, height);
            let image1 = this.crop(x, y, width - 1, height);
            let image2 = this.overlay(image1, x + 1, y);
            image3 = image2.overlay(image0, x, y);
        }
        return image3;
    }
    
    // Move the content to the up inside the rectangle, wrap around when reaching the top edge.
    moveUp(x, y, width, height) {
        var image3 = this.clone();
        if (height >= 2) {
            let image0 = this.crop(x, y, width, 1);
            let image1 = this.crop(x, y + 1, width, height - 1);
            let image2 = this.overlay(image1, x, y);
            image3 = image2.overlay(image0, x, y + height - 1);
        }
        return image3;
    }
    
    // Move the content to the down inside the rectangle, wrap around when reaching the bottom edge.
    moveDown(x, y, width, height) {
        var image3 = this.clone();
        if (height >= 2) {
            let image0 = this.crop(x, y + height - 1, width, 1);
            let image1 = this.crop(x, y, width, height - 1);
            let image2 = this.overlay(image1, x, y + 1);
            image3 = image2.overlay(image0, x, y);
        }
        return image3;
    }
}

class ARCPair {
    constructor(input, output) {
        this.input = new ARCImage(input);
        this.output = new ARCImage(output);
    }
}

class ARCTask {
    constructor(datasetId, taskId, jsonData) {
        if (typeof datasetId !== 'string') {
            throw new Error(`datasetId is not a string. datasetId: ${datasetId}`);
        }
        if (typeof taskId !== 'string') {
            throw new Error(`taskId is not a string. taskId: ${taskId}`);
        }
        this.datasetId = datasetId;
        this.taskId = taskId;
        this.jsonData = jsonData;
        this.train = jsonData.train.map(pair => new ARCPair(pair.input, pair.output));
        this.test = jsonData.test.map(pair => new ARCPair(pair.input, pair.output));

        let encodedTaskId = encodeURIComponent(taskId);
        let encodedDatasetId = encodeURIComponent(datasetId);
        this.openUrl = `edit.html?dataset=${encodedDatasetId}&task=${encodedTaskId}`;
        this.thumbnailCacheId = `task_thumbnail_${datasetId}_${taskId}`;
    }

    customUrl(callbackUrl, actionId) {
        let encodedActionId = encodeURIComponent(actionId);
        let encodedTaskId = encodeURIComponent(this.taskId);
        let encodedDatasetId = encodeURIComponent(this.datasetId);
        var url = callbackUrl;
        if ((url === undefined) || (url === null) || (url === '')) {
            url = 'arc-interactive-callback.html';
        }
        url = url.replace(/\bTASKID\b/g, this.taskId);
        url = url.replace(/\bDATASETID\b/g, this.datasetId);

        // append ? if needed
        if (url.indexOf('?') === -1) {
            url += "?";
        }
        
        url += `action=${encodedActionId}&dataset=${encodedDatasetId}&task=${encodedTaskId}`;
        return url;
    }

    toThumbnailCanvas(theme, extraWide, scale) {
        var width = 320 * scale;
        if (extraWide) {
            width *= 2;
        }
        let height = 150 * scale;

        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        thumbnailCanvas.width = width;
        thumbnailCanvas.height = height;

        let insetValue = 5;
        let canvas = this.toCanvas(theme, insetValue, extraWide);
        thumbnailCtx.drawImage(canvas, 0, 0, thumbnailCanvas.width, thumbnailCanvas.height);
        return thumbnailCanvas;
    }

    toCustomCanvasSize(theme, extraWide, width, height) {
        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');
        thumbnailCanvas.width = width;
        thumbnailCanvas.height = height;

        let insetValue = 5;
        let canvas = this.toCanvas(theme, 0, extraWide);
        thumbnailCtx.drawImage(canvas, insetValue, insetValue, thumbnailCanvas.width - 2 * insetValue, thumbnailCanvas.height - 2 * insetValue);
        return thumbnailCanvas;
    }

    toCanvas(theme, insetValue, extraWide) {
        let scale = 1;
        var width = 320 * scale;
        if (extraWide) {
            width *= 2;
        }
        let height = 150 * scale;
        let inset = insetValue * scale;

        let inputOutputGapSize = 5 * scale;
        let pairGapSize = 5 * scale;
        let trainTestGapSize = 5 * scale;

        // Truncate those puzzles that are way too wide to fit in the thumbnail
        let n_train = Math.min(this.train.length, thumbnail_max_train_count);

        let n_test = this.test.length;
        let count = n_train + n_test;

        let cellWidthTotalAvailable = width - 2 * inset;

        let cellWidthWithoutGap = cellWidthTotalAvailable / count;
        let cellWidthWithGap = cellWidthWithoutGap - pairGapSize;
        let cellHeight = (height - inputOutputGapSize - 2 * inset) / 2;


        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
 
        // ctx.fillStyle = 'white';
        // ctx.fillRect(0, 0, width, height);
        // ctx.fillStyle = '#282828';
        // ctx.fillStyle = 'black';
        // ctx.fillRect(inset, inset, width - inset * 2, height - inset * 2);

        let trainTestGap = scale;

        ctx.fillStyle = '#333';
        let inset1 = 0;
        let trainWidth = (n_train * cellWidthTotalAvailable) / count - trainTestGap;
        ctx.fillRect(inset, inset1, trainWidth, height - inset1 * 2);

        // ctx.fillStyle = 'black';
        // ctx.fillRect(inset, height / 2 - 1, width - inset * 2, 2);
    
        // ctx.fillStyle = '#ffffff';
        // ctx.fillRect((n_train * width) / count, 0, width - (n_train * width) / count, height);

        // ctx.fillStyle = 'rgb(70, 60, 40)';
        ctx.fillStyle = 'rgb(60, 50, 60)';
        let maskWidth = (n_test * cellWidthTotalAvailable) / count + inset - trainTestGap;
        let maskX = width - maskWidth - inset1;
        ctx.fillRect(
            maskX, 
            inset1,
            maskWidth, 
            height - inset1 * 2
        );


        var cellSize = 1000000;
        for (let i = 0; i < n_train; i++) {
            let size0 = this.train[i].input.cellSize(cellWidthWithGap, cellHeight);
            let size1 = this.train[i].output.cellSize(cellWidthWithGap, cellHeight);
            cellSize = Math.min(cellSize, Math.min(size0, size1));
        }
        for (let i = 0; i < n_test; i++) {
            let size0 = this.test[i].input.cellSize(cellWidthWithGap, cellHeight);
            let size1 = this.test[i].output.cellSize(cellWidthWithGap, cellHeight);
            cellSize = Math.min(cellSize, Math.min(size0, size1));
        }
    
        for (let i = 0; i < n_train; i++) {
            let x = (i * cellWidthTotalAvailable) / count + inset;
            let y0 = inset;
            let y1 = height / 2;
            this.train[i].input.draw(theme, ctx, x, y0, cellWidthWithoutGap, cellHeight, cellSize, {alignBottom: true});
            this.train[i].output.draw(theme, ctx, x, y1, cellWidthWithoutGap, cellHeight, cellSize, {alignTop: true});
        }
        for (let i = 0; i < n_test; i++) {
            let x = ((n_train + i) * cellWidthTotalAvailable) / count + inset;
            let y0 = inset;
            let y1 = height / 2;
            this.test[i].input.draw(theme, ctx, x, y0, cellWidthWithoutGap, cellHeight, cellSize, {alignBottom: true});
            // this.test[i].output.draw(theme, ctx, x, y1, cellWidthWithoutGap, cellHeight, cellSize, {alignTop: true});
        }

        // for (let i = 1; i < count; i++) {
        //     ctx.fillStyle = 'black';
        //     ctx.fillRect((i * cellWidthTotalAvailable) / count + inset, inset, 1, height - inset * 2);
        // }
    
        // ctx.fillStyle = 'rgb(78, 76, 58)';
        // ctx.fillStyle = 'rgb(78, 60, 40)';
        // ctx.fillStyle = 'rgb(70, 60, 40)';
        // let maskWidth = (n_test * cellWidthTotalAvailable) / count;
        // let maskX = width - maskWidth - inset;
        // ctx.fillRect(
        //     maskX, 
        //     height / 2,
        //     maskWidth, 
        //     cellHeight + inputOutputGapSize / 2
        // );

        // ctx.fillStyle = 'black';
        // ctx.fillRect((n_train * cellWidthTotalAvailable) / count + inset - Math.floor(trainTestGapSize / 2), inset, trainTestGapSize, height - inset * 2);
        // ctx.fillRect((n_train * cellWidthTotalAvailable) / count + inset - Math.floor(trainTestGapSize / 2), inset, 1, height - inset * 2);
        // ctx.fillRect((n_train * cellWidthTotalAvailable) / count + inset - Math.floor(trainTestGapSize / 2), inset, 2, height - inset * 2);
        // ctx.fillRect((n_train * cellWidthTotalAvailable) / count + inset - Math.floor(trainTestGapSize / 2), 0, 2, height);

        return canvas;
    }

    // Return an integer with the accumulated width of all the pairs in the task
    calcThumbnailWidth(gapSize, maxTrain) {
        let n_train = Math.min(this.train.length, maxTrain);
        var accumulatedWidth = 0;
        for (let i = 0; i < n_train; i++) {
            let image0 = this.train[i].input;
            let image1 = this.train[i].output;
            accumulatedWidth += Math.max(image0.width, image1.width);
            if (i > 0) {
                accumulatedWidth += gapSize;
            }
        }
        accumulatedWidth += gapSize;
        for (let i = 0; i < this.test.length; i++) {
            let image0 = this.test[i].input;
            let image1 = this.test[i].output;
            accumulatedWidth += Math.max(image0.width, image1.width);
            if (i > 0) {
                accumulatedWidth += gapSize;
            }
        }
        return accumulatedWidth;
    }

    // Return an integer with the max height of all the pairs in the task
    calcThumbnailHeight(gapSize) {
        var maxHeight = 0;
        for (let i = 0; i < this.train.length; i++) {
            let image0 = this.train[i].input;
            let image1 = this.train[i].output;
            let sum = image0.height + image1.height + gapSize;
            maxHeight = Math.max(maxHeight, sum);
        }
        for (let i = 0; i < this.test.length; i++) {
            let image0 = this.test[i].input;
            let image1 = this.test[i].output;
            let sum = image0.height + image1.height + gapSize;
            maxHeight = Math.max(maxHeight, sum);
        }
        return maxHeight;
    }

    // Return true if the task is extra wide.
    //
    // Return false if the task is normal.
    isExtraWideThumbnail() {
        if (this.train.length >= thumbnail_max_train_count) {
            return true;
        }

        let gapSize = 1;
        let width = this.calcThumbnailWidth(gapSize, thumbnail_max_train_count);
        let height = this.calcThumbnailHeight(gapSize);
        if (width > 150) {
            return true;
        }
        if (width < 1 || height < 1) {
            return false;
        }
        if (width < 60) {
            return false;
        }
        let aspectRatio = width / height;
        return aspectRatio >= 3;
    }
}

class Settings {
    static getAdvancedModeEnabled() {
        let value = localStorage.getItem('settings-advanced-mode-enabled');
        let isEnabled = ((value === 'true') || (value === true));
        // by default the advanced mode is disabled
        return isEnabled;
    }

    static setAdvancedModeEnabled(enabled) {
        if (typeof enabled !== 'boolean') {
            throw new Error(`Invalid enabled: ${enabled}`);
        }
        localStorage.setItem('settings-advanced-mode-enabled', enabled);
    }
}
