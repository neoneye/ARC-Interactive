class PageController {
    constructor() {
        this.db = null;
        this.dataset = null;
        this.theme = null;
        this.historyDirectoryContent = null;
        this.visibleTasks = [];

        // Assign urls to buttons in the navigation bar, so the URL parameters gets preserved.
        {
            document.getElementById('settings-button').href = 'settings.html' + window.location.search;
            document.getElementById('about-button').href = 'about.html' + window.location.search;
        }

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
        document.title = this.datasetId + " - ARC-Interactive";

        // Extract the "filter" from urlParams, it looks like this: 
        // "filter=hard,-ambiguous", this gives the hard tasks, but not the ambiguous ones.
        // "filter=-easy", this gives all tasks except the easy ones.
        const urlParamFilter = urlParams.get('filter');
        if (urlParamFilter) {
            // console.log("Filter:", urlParamFilter);
            this.filter = urlParamFilter;
        } else {
            this.filter = null;
        }

        // At the moment the "filter" is only used for the ARC dataset.
        if (this.datasetId != 'ARC') {
            this.filter = null;
        }

        // At the moment the "filter" is only used for the ARC dataset.
        if (this.datasetId == 'ARC') {
            // Show the "filter-settings" when the dataset is ARC.
            // Otherwise hide it.
            document.getElementById('filter-settings').classList.remove('hidden');
        }
    }

    async onload() {
        Theme.assignBodyClassName();
        this.theme = Theme.themeFromBody();

        this.db = await DatabaseWrapper.create();

        this.historyDirectoryContent = await PageController.fetchHistoryDirectoryContent();

        // console.log('PageController.onload()', this.db);
        this.setupDatasetPicker();
        this.setupAdvancedFilterTag();
        this.setupAdvancedToolPicker();
        this.setupAdvancedFilterPreviousNextButtons();
        this.populateFilterListTags();
        this.populateFilterListCategories();
        this.updateFilterButtons();
        this.updatePreviousNextButtons();
        await this.loadTasks();

        addEventListener("pagehide", (event) => { this.onpagehide(); });

        this.scrollPositionRestore();
        this.scrollPositionReset();
        this.scrollViewFocus();

        // Listen for the keyup event
        window.addEventListener('keyup', (event) => { this.keyUp(event); });
    }

    static async fetchHistoryDirectoryContent() {
        let url = 'https://raw.githubusercontent.com/neoneye/ARC-Interactive-History-Dataset/main/history_files/directory_content.json';
        try {
            const response = await fetch(url);
            // console.log('response:', response);
            const arrayBuffer = await response.arrayBuffer();
            let uint8Array = new Uint8Array(arrayBuffer);
            let jsonString = new TextDecoder().decode(uint8Array);
            let json = JSON.parse(jsonString);
            // console.log('json:', json);
            console.log('number of items in historyDirectoryContent json:', Object.keys(json).length);            
            return json;
        } catch (error) {
            console.error('unable to fetch historyDirectoryContent json', error, url);
            return [];
        }
    }

    // Keyboard shortcuts
    keyUp(event) {
        // console.log(event.code);

        // Get the currently focused element
        let activeElement = document.activeElement;

        // Check if the focused element is a text input or textarea
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            // If so, don't execute the rest of the keyUp function
            // This allows normal behavior for text input, like moving the cursor
            // console.log('Focused element is a text input or textarea', event.code);
            return;
        }

        if (event.code === 'KeyP') {
            let el = document.getElementById('filter-previous-button');
            if (!el.classList.contains('hidden')) {
                el.click();
            }
        }

        if (event.code === 'KeyN') {
            let el = document.getElementById('filter-next-button');
            if (!el.classList.contains('hidden')) {
                el.click();
            }
        }
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

            // Preserve the url parameters, and overwrite the 'dataset' parameter.
            let urlParams = new URLSearchParams(window.location.search);
            urlParams.set('dataset', select.value);

            // Redirect to the 'index.html' page, with the new url parameters.
            window.location.href = '.?' + urlParams.toString();
        });
    }

    setupAdvancedFilterTag() {
        if (!Settings.getAdvancedModeEnabled()) {
            // Advanced mode is not enabled, so we don't show the filter by tag.
            return;
        }

        // Show the advanced filter by tag
        {
            var el = document.getElementById('advanced-filter-tag');
            el.classList.remove('hidden');
        }
    }

    setupAdvancedFilterPreviousNextButtons() {
        if (!Settings.getAdvancedModeEnabled()) {
            // Advanced mode is not enabled, so we don't show the "Previous" / "Next" buttons.
            return;
        }

        if (this.datasetId != 'ARC') {
            // It's only the ARC dataset that have tags, so there is no point in showing the "Previous" / "Next" buttons.
            console.log("Not ARC dataset. Doesn't make sense to show the 'Previous' / 'Next' buttons.");
            return;
        }

        // Show the previous/next buttons
        {
            document.getElementById('filter-previous-button').classList.remove('hidden');
            document.getElementById('filter-next-button').classList.remove('hidden');
        }
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
            let availableTools = ['edit', 'history', 'custom-a', 'custom-b'];
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
                if (META_ARC_LEVELS[filterId]) {
                    taskIds = META_ARC_LEVELS[filterId];
                }
                if (Settings.getAdvancedModeEnabled()) {
                    // if filterId starts with 'cat50_', then it's a category filter.
                    let categoryPrefix = 'cat50_';
                    if (filterId.startsWith(categoryPrefix)) {
                        let categoryFilterId = filterId.substring(categoryPrefix.length);
                        if (META_ARC_CATEGORY_50[categoryFilterId]) {
                            taskIds = META_ARC_CATEGORY_50[categoryFilterId];
                        }
                    }

                    if (META_ARC_TAGS[filterId]) {
                        taskIds = META_ARC_TAGS[filterId];
                    }
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
        this.visibleTasks = filteredTasksStage2;

        this.updateVisibleTaskCount();
        this.showVisibleTasks();
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
        let task = this.visibleTasks[index];
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

    updateVisibleTaskCount() {
        let text = '';
        if (this.visibleTasks.length == 0) {
            text = 'No tasks found. Adjust filter settings to see more.';
        } else {
            text = `Number of tasks: ${this.visibleTasks.length}`;
        }
        let el = document.getElementById('filter-status');
        el.innerText = text;
    }

    showVisibleTasks() {
        let tasks = this.visibleTasks;
        console.log('Show tasks:', tasks.length);
        let openInNewTab = false;

        let customUrl = localStorage.getItem('arc-interactive-callback-url');

        var filterUrlParam = '';
        if (this.filter && this.filter.length > 0) {
            filterUrlParam = `&filter=${this.filter}`;
        }

        let el_gallery = document.getElementById('gallery');

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
            el_a.href = task.openUrl + filterUrlParam;
            el_a.setAttribute("data-tool-edit", task.openUrl + filterUrlParam);
            el_a.setAttribute("data-tool-custom-a", task.customUrl(customUrl, 'custom-a') + filterUrlParam);
            el_a.setAttribute("data-tool-custom-b", task.customUrl(customUrl, 'custom-b') + filterUrlParam);

            let historyTasks = this.historyDirectoryContent[this.datasetId];
            if (historyTasks) {
                let historyTaskPathArray = historyTasks[task.taskId];
                if (historyTaskPathArray) {
                    let historyTaskPath = historyTaskPathArray[0];
                    let baseUrl = 'https://raw.githubusercontent.com/neoneye/ARC-Interactive-History-Dataset/main/history_files/';
                    let historyUrl = baseUrl + historyTaskPath;
                    let historyTask = encodeURIComponent(historyUrl);
                    el_a.setAttribute("data-tool-history", `history.html?historyUrl=${historyTask}`);
                }
            }


            if (openInNewTab) {
                el_a.target = "_blank";
            }
            el_a.appendChild(el_img);    
            el_gallery.appendChild(el_a);
        }
    }

    assignThumbnailUrlsBasedOnCurrentTool() {
        let toolIdentifier = localStorage.getItem('task-gallery-tool');
        let availableTools = ['edit', 'history', 'custom-a', 'custom-b'];
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

    populateFilterListTags() {
        let el = document.getElementById('filter-list-tags');
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
        let keys = Object.keys(META_ARC_TAGS);
        keys.sort();
        for (let i = 0; i < keys.length; i++) {
            let filterId = keys[i];
            let el_tag = document.createElement('a');
            el_tag.innerText = filterId;
            el_tag.setAttribute('data-filter', filterId);
            if (filterId == "parapraxis-correct-1shot") {
                el_tag.title = "Solved by Parapraxis LLM, as of 2024-Feb-11";
            }
            if (filterId == "parapraxis-correct-3shots-after-voting") {
                el_tag.title = "Solved by Parapraxis LLM, as of 2024-Feb-11";
            }
            el.appendChild(el_tag);
            let el_space = document.createElement('span');
            el_space.innerText = ' ';
            el.appendChild(el_space);
        }    
    }

    populateFilterListCategories() {
        let prefix = 'cat50_';
        let el = document.getElementById('filter-list-categories');
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }
        let keys = Object.keys(META_ARC_CATEGORY_50);
        for (let i = 0; i < keys.length; i++) {
            let filterId = keys[i];
            let el_tag = document.createElement('a');
            el_tag.innerText = filterId;
            el_tag.setAttribute('data-filter', prefix + filterId);
            el.appendChild(el_tag);
            let el_space = document.createElement('span');
            el_space.innerText = ' ';
            el.appendChild(el_space);
        }    
    }

    updateFilterButtons() {
        // Determine what buttons are currently active.
        var filterButtonsPlus = [];
        var filterButtonsMinus = [];
        if (this.filter) {
            console.log('Filter:', this.filter);
            let parts = this.filter.split(',');
            for (let i = 0; i < parts.length; i++) {
                let part = parts[i];
                var filterId = part;
                if (part.startsWith('-')) {
                    filterId = part.substring(1);
                    filterButtonsMinus.push(filterId);
                } else {
                    filterButtonsPlus.push(filterId);
                }
            }
        }
        console.log('filterButtonsPlus:', filterButtonsPlus);
        console.log('filterButtonsMinus:', filterButtonsMinus);

        // Traverse all links and update their href and class.
        let links = document.querySelectorAll('a[data-filter]'); // Assuming all links have a `data-filter` attribute
        links.forEach(link => {
            let filterId = link.getAttribute('data-filter');

            // Copy the arrays, but without the current button.
            var newFilterButtonsPlus = filterButtonsPlus.filter(item => item !== filterId);
            var newFilterButtonsMinus = filterButtonsMinus.filter(item => item !== filterId);

            // Insert the current button into the opposite array. Since it's tristate.
            // If it's normal mode, switch it to plus array.
            // If it's a plus, insert it into the minus array.
            // If it's a minus, switch it to normal mode.
            if (filterId) {
                if (filterButtonsPlus.includes(filterId)) {
                    newFilterButtonsMinus.push(filterId);
                } else {
                    if (!filterButtonsMinus.includes(filterId)) {
                        newFilterButtonsPlus.push(filterId);
                    }
                }
            }
            
            let url = this.createUrlWithFilterParameters(newFilterButtonsPlus, newFilterButtonsMinus);
            link.href = url;

            // Set the class of the link, so it's highlighted depending on if it's plus/minus/neutral.
            if (filterButtonsPlus.includes(filterId)) {
                link.className = 'filter-plus';
            } else {
                if (filterButtonsMinus.includes(filterId)) {
                    link.className = 'filter-minus';
                } else {
                    link.className = '';
                }
            }
        });
    }

    updatePreviousNextButtons() {
        // get all `<a>` elements with `data-filter` attribute
        let links = document.querySelectorAll('a[data-filter]'); // Assuming all links have a `data-filter` attribute

        if (links.length == 0) {
            console.log('No links found');
            return;
        }

        var foundIndex = 0;
        for(var i = 0; i < links.length; i++) {
            var link = links[i];
            // console.log(link);

            // Does this link have a class of 'filter-plus'?
            if (!link.classList.contains('filter-plus')) {
                continue;
            }

            console.log('filter-plus');

            // If it does, then we have found the previous button.
            foundIndex = i;
            break;
        }
        if (foundIndex >= links.length) {
            console.log('No next link found');
            return;
        }
        {
            let prevButtonIndex = (foundIndex + links.length - 1) % links.length; 
            var el_a = links[prevButtonIndex];
            let filterId = el_a.getAttribute('data-filter');
            let url = this.createUrlWithFilterParameters([filterId], []);
            document.getElementById('filter-previous-button').href = url;
        }
        {
            let nextButtonIndex = (foundIndex + 1) % links.length; 
            var el_a = links[nextButtonIndex];
            let filterId = el_a.getAttribute('data-filter');
            let url = this.createUrlWithFilterParameters([filterId], []);
            document.getElementById('filter-next-button').href = url;
        }
    }

    createUrlWithFilterParameters(filterIdArrayPlus, filterIdArrayMinus) {
        // Copy the arrays.
        var newFilterButtonsPlus = filterIdArrayPlus.slice();
        var newFilterButtonsMinus = filterIdArrayMinus.slice();

        // Sort the arrays, so url generation is deterministic.
        newFilterButtonsPlus.sort();
        newFilterButtonsMinus.sort();

        // Concatenate the filter parameters
        var filterParameterString = '';
        if (newFilterButtonsPlus.length > 0) {
            filterParameterString = newFilterButtonsPlus.join(',');
        }
        for (let i = 0; i < newFilterButtonsMinus.length; i++) {
            if (filterParameterString.length > 0) {
                filterParameterString += ',';
            }
            filterParameterString += '-' + newFilterButtonsMinus[i];
        }

        // Generate the url
        let urlParams = new URLSearchParams(window.location.search);
        if (filterParameterString.length > 0) {
            urlParams.set('filter', filterParameterString);
        } else {
            urlParams.delete('filter');
        }
        let url = '.?' + urlParams.toString();
        return url;
    }
}

var gPageController = null;
  
function body_onload() {
    gPageController = new PageController();
    (async () => {
        gPageController.onload();
    })();
}
