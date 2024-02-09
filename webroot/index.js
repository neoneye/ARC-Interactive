class PageController {
    constructor() {
        this.db = null;
        this.dataset = null;
        this.theme = null;

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

        // Extract the "filter" from urlParams, it looks like this: 
        // "filter=hard,-ambiguous", this gives the hard tasks, but not the ambiguous ones.
        // "filter=-easy", this gives all tasks except the easy ones.
        const urlParamFilter = urlParams.get('filter');
        if (urlParamFilter) {
            console.log("Filter:", urlParamFilter);
            this.filter = urlParamFilter;
        } else {
            this.filter = null;
        }

        document.title = this.datasetId + " - ARC-Interactive";
    }

    async onload() {
        Theme.assignBodyClassName();
        this.theme = Theme.themeFromBody();

        this.db = await DatabaseWrapper.create();
        // console.log('PageController.onload()', this.db);
        this.setupDatasetPicker();
        this.setupAdvancedToolPicker();
        await this.loadTasks();

        addEventListener("pagehide", (event) => { this.onpagehide(); });

        this.scrollPositionRestore();
        this.scrollPositionReset();
        this.scrollViewFocus();
    }

    // The pagehide event is sent to a Window when the browser hides the current page in the process of 
    // presenting a different page from the session's history.
    // https://developer.mozilla.org/en-US/docs/Web/API/Window/pagehide_event
    onpagehide() {
        // console.log('PageController.onpagehide()');
        this.scrollPositionSave();
    }
    
    // Save scroll position in sessionStorage, so that we can restore it when the page is reloaded.
    // When the user moves to another page, and then clicks the back button, the page is scrolled to the original position.
    scrollPositionSave() {
        let key = this.scrollPositionKey();
        let el = document.getElementById('main-inner');
        let scrollTop = el.scrollTop;
        let value = scrollTop.toString();
        sessionStorage.setItem(key, value);
        console.log(`Saved scroll position. key: '${key}' value: ${value}`);
    }

    // Restore scroll position
    // When the user moves to another page, and then clicks the back button, the page is scrolled to the original position.
    scrollPositionRestore() {
        let key = this.scrollPositionKey();
        let el = document.getElementById('main-inner');
        let rawValue = sessionStorage.getItem(key);
        if (typeof rawValue != 'undefined') {
            let value = parseInt(rawValue);
            if (value > 0) {
                el.scrollTop = value;
                console.log(`Restored scroll position. key: '${key}' value: ${value}`);
            }
        }
    }

    // Remove the value from sessionStorage, so that it is not restored again.
    scrollPositionReset() {
        let key = this.scrollPositionKey();
        sessionStorage.removeItem(key);
        console.log(`Reset scroll position. key: '${key}'`);
    }

    scrollPositionKey() {
        var pathName = document.location.pathname;
        // console.log('scrollPositionKey() pathName:', pathName);
        if (pathName == '/index.html') {
            // console.log('scrollPositionKey() pathName is index.html. Setting to /');
            pathName = '/';
        }
        let key = "scrollPosition_" + pathName;
        return key;
    }

    scrollTopSetZero() {
        let el = document.getElementById('main-inner');
        el.scrollTop = 0;
    }

    scrollViewFocus() {
        let el = document.getElementById('main-inner');
        el.focus();
    }

    setupDatasetPicker() {
        var select = document.getElementById('select-dataset');

        // Set the selected option in the dropdown
        select.value = this.datasetId;

        // Listen for changes to the selected option
        select.addEventListener('change', () => {
            this.scrollTopSetZero();
            window.location.href = `index.html?dataset=${encodeURIComponent(select.value)}`;
        });
    }

    setupAdvancedToolPicker() {
        if (!Settings.getAdvancedModeEnabled()) {
            // Advanced mode is not enabled, so we don't show the tool picker.
            return;
        }

        // Show the advanced tool picker
        {
            var el = document.getElementById('advanced-tool');
            el.classList.remove('hidden');
        }

        var select = document.getElementById('select-tool');

        // Set the selected option in the dropdown
        {
            let toolIdentifier = localStorage.getItem('task-gallery-tool');
            let availableTools = ['edit', 'custom-a', 'custom-b'];
            if (!availableTools.includes(toolIdentifier)) {
                toolIdentifier = 'edit';
            }
            select.value = toolIdentifier;
        }

        // Listen for changes to the selected option
        select.addEventListener('change', () => {
            let toolIdentifier = select.value;
            console.log('select-tool change', toolIdentifier);
            localStorage.setItem('task-gallery-tool', toolIdentifier);
            this.assignThumbnailUrlsBasedOnCurrentTool();
        });
    }

    async loadTasks() {
        console.log('PageController.loadTasks()');
        try {
            let dataset = await Dataset.load(this.db, this.datasetId);
            this.dataset = dataset;
        } catch (error) {
            console.error('Error loading bundle', error);
        }
        var includedTaskIds = [];
        var excludedTaskIds = [];
        if (this.filter) {
            console.log('Filter:', this.filter);
            let parts = this.filter.split(',');
            for (let i = 0; i < parts.length; i++) {
                let part = parts[i];
                var filterId = part;
                var includeTask = true;
                if (part.startsWith('-')) {
                    filterId = part.substring(1);
                    includeTask = false;
                }

                var taskIds = [];
                if (filterId == 'entry') {
                    taskIds = ARC_LEVELS.entry;
                }
                if (filterId == 'easy') {
                    taskIds = ARC_LEVELS.easy;
                }
                if (filterId == 'medium') {
                    taskIds = ARC_LEVELS.medium;
                }
                if (filterId == 'hard') {
                    taskIds = ARC_LEVELS.hard;
                }
                if (filterId == 'tedious') {
                    taskIds = ARC_LEVELS.tedious;
                }
                if (filterId == 'multiple-solutions') {
                    taskIds = ARC_LEVELS.multipleSolutions;
                }
                if (filterId == 'unfixed') {
                    taskIds = ARC_LEVELS.unfixed;
                }
                if (includeTask) {
                    includedTaskIds = includedTaskIds.concat(taskIds);
                } else {
                    excludedTaskIds = excludedTaskIds.concat(taskIds);
                }
            }
        } else {
            console.log('No filter');
        }
        var filteredTasksStage1 = [];
        if (includedTaskIds.length > 0) {
            for(let i = 0; i < this.dataset.tasks.length; i++) {
                let task = this.dataset.tasks[i];
                if (includedTaskIds.includes(task.taskId)) {
                    filteredTasksStage1.push(task);
                }
            }
        } else {
            filteredTasksStage1 = this.dataset.tasks;
        }
        let filteredTasksStage2 = [];
        if (excludedTaskIds.length > 0) {
            for(let i = 0; i < filteredTasksStage1.length; i++) {
                let task = filteredTasksStage1[i];
                if (!excludedTaskIds.includes(task.taskId)) {
                    filteredTasksStage2.push(task);
                }
            }
        } else {
            filteredTasksStage2 = filteredTasksStage1;
        }
        this.showTasks(filteredTasksStage2);
        this.assignThumbnailUrlsBasedOnCurrentTool();
        this.hideOverlay();

        if ("IntersectionObserver" in window) {
            let lazyImages = [].slice.call(document.querySelectorAll("img.lazy-load"));
            let lazyImageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => { this.lazyImageCallback(entry, observer); });
            });
            lazyImages.forEach(function(lazyImage) {
                lazyImageObserver.observe(lazyImage);
            });
        } else {
            console.log('IntersectionObserver not supported');
        }
    }

    // Render thumbnails for the tasks that are visible in the viewport.
    lazyImageCallback(entry, lazyImageObserver) {
        if (!entry.isIntersecting) {
            return;
        }
        let lazyImage = entry.target;
        let taskindex = lazyImage.dataset.taskindex;
        lazyImage.classList.remove("lazy-load");
        lazyImageObserver.unobserve(lazyImage);
        // console.log('Lazy load image', lazyImage, taskindex);

        let index = parseInt(taskindex);
        if (index < 0) {
            console.log('Invalid taskindex', taskindex);
            return;
        }
        let task = this.dataset.tasks[index];
        if (!task) {
            console.log('Invalid task at index', index, task);
            return;
        }

        // console.log('Lazy load image', lazyImage, taskindex, task);
        let extraWide = task.isExtraWideThumbnail();
        let width = extraWide ? 320 : 160;
        let height = 80;

        let scale = 2;
        let canvas = task.toCustomCanvasSize(this.theme, extraWide, width * scale, height * scale);
        let url = canvas.toDataURL();
        lazyImage.src = url;
    }

    hideOverlay() {
        document.getElementById("overlay").style.display = "none";
    }

    showTasks(tasks) {
        console.log('Show tasks:', tasks.length);
        let openInNewTab = false;

        let customUrl = localStorage.getItem('arc-interactive-callback-url');

        const el_gallery = document.getElementById('gallery');

        for (let i = 0; i < tasks.length; i++) {
            let task = tasks[i];

            let extraWide = task.isExtraWideThumbnail();

            const el_img = document.createElement('img');
    
            el_img.className = "lazy-load";
            if (extraWide) {
                el_img.classList.add("gallery_cell_image_wide");
            } else {
                el_img.classList.add("gallery_cell_image_normal");
            }
            el_img.src = "image/loading.jpg";
            el_img.setAttribute("data-taskindex", `${i}`);
    
            const el_a = document.createElement('a');
            if (extraWide) {
                el_a.className = 'gallery_cell gallery_cell_wide';
            } else {
                el_a.className = 'gallery_cell gallery_cell_normal';
            }
            el_a.href = task.openUrl;
            el_a.setAttribute("data-tool-edit", task.openUrl);
            el_a.setAttribute("data-tool-custom-a", task.customUrl(customUrl, 'custom-a'));
            el_a.setAttribute("data-tool-custom-b", task.customUrl(customUrl, 'custom-b'));
            if (openInNewTab) {
                el_a.target = "_blank";
            }
            el_a.appendChild(el_img);    
            el_gallery.appendChild(el_a);
        }
    }

    assignThumbnailUrlsBasedOnCurrentTool() {
        let toolIdentifier = localStorage.getItem('task-gallery-tool');
        let availableTools = ['edit', 'custom-a', 'custom-b'];
        if (!availableTools.includes(toolIdentifier)) {
            toolIdentifier = 'edit';
        }
        if (!Settings.getAdvancedModeEnabled()) {
            toolIdentifier = 'edit';
        }

        let links = document.querySelectorAll('a[data-tool-edit]'); // Assuming all links have a `data-tool-edit` attribute
        let attributeName = `data-tool-${toolIdentifier}`;
        links.forEach(link => {
            link.href = link.getAttribute(attributeName);
        });
    }
}

var gPageController = null;
  
function body_onload() {
    gPageController = new PageController();
    (async () => {
        gPageController.onload();
    })();
}
