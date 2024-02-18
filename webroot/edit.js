function goBack() {
    history.back(); // Go back to the previous page
    return false;  // Prevents the default anchor action
}

// https://stackoverflow.com/questions/9038625/detect-if-device-is-ios
function iOS() {
    return [
      'iPad Simulator',
      'iPhone Simulator',
      'iPod Simulator',
      'iPad',
      'iPhone',
      'iPod'
    ].includes(navigator.platform)
    // iPad on iOS 13 detection
    || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

function enableFullscreenMode() {
    if (iOS()) {
        // Fullscreen mode behaves weird on iPad. It's better to disable it.
        // Fullscreen mode is not available on iPhone. It's better to disable it.
        return false;
    }
    return true;
}

class Memento {
    constructor(state, actionName) {
        this.state = state;
        this.actionName = actionName;
    }

    getState() {
        return this.state;
    }

    getActionName() {
        return this.actionName;
    }
}

class Originator {
    constructor() {
        let emptyImage = ARCImage.color(100, 100, 0);
        this.state = {
            image: emptyImage,
        };
    }

    setState(state) {
        this.state = state;
    }

    setImage(image) {
        this.state.image = image.clone();
    }

    getImageClone() {
        return this.state.image.clone();
    }

    getImageRef() {
        return this.state.image;
    }

    saveStateToMemento(actionName) {
        let savedState = {
            image: this.state.image.clone(),
        };
        return new Memento(savedState, actionName);
    }

    getStateFromMemento(memento) {
        this.state = memento.getState();
    }
}

class Caretaker {
    constructor() {
        this.undoList = [];
        this.redoList = [];
    }

    saveState(originator, actionName) {
        this.redoList = []; // Clear the redoList because new action invalidates the redo history
        this.undoList.push(originator.saveStateToMemento(actionName));
    }

    clearHistory() {
        this.undoList = [];
        this.redoList = [];
    }

    printHistory() {
        console.log("Action History:");
        this.undoList.forEach((memento, index) => {
            console.log(`${index + 1}: ${memento.getActionName()}`);
        });
    }

    undo(originator) {
        if (this.undoList.length > 0) {
            const memento = this.undoList.pop();
            const actionName = memento.getActionName();
            this.redoList.push(originator.saveStateToMemento(`Undo ${actionName}`)); // save current state before undoing
            originator.getStateFromMemento(memento);
            console.log(`Undid action: ${actionName}`);
        } else {
            console.log('No actions to undo.');
        }
    }

    redo(originator) {
        if (this.redoList.length > 0) {
            const memento = this.redoList.pop();
            const actionName = memento.getActionName();
            this.undoList.push(originator.saveStateToMemento(`Redo ${actionName}`)); // save current state before redoing
            originator.getStateFromMemento(memento);
            console.log(`Redid action: ${actionName}`);
        } else {
            console.log('No actions to redo.');
        }
    }
}

class DrawingItem {
    constructor() {
        this.id = 0;
        this.caretaker = new Caretaker();
        this.originator = new Originator();
        this.selectRectangle = { 
            x0: 0, 
            y0: 0,
            x1: 0,
            y1: 0,
        };
    }

    getSelectedRectangleCoordinates() {
        let minX = Math.min(this.selectRectangle.x0, this.selectRectangle.x1);
        let maxX = Math.max(this.selectRectangle.x0, this.selectRectangle.x1);
        let minY = Math.min(this.selectRectangle.y0, this.selectRectangle.y1);
        let maxY = Math.max(this.selectRectangle.y0, this.selectRectangle.y1);
        return { minX, maxX, minY, maxY };
    }

    assignSelectRectangleFromCurrentImage() {
        let image = this.originator.getImageRef();
        this.selectRectangle = {
            x0: 0,
            y0: 0,
            x1: image.width - 1,
            y1: image.height - 1,
        };
    }
}

class HistoryItem {
    constructor(id, date) {
        // The `id` is a non-negative integer that gets incremented for each new history item.
        this.id = id;

        // The `date` is a Date object that represents the time when the history item was created.
        this.date = date;
    }

    static create() {
        let id = 0;
        let instance = new HistoryItem(id, new Date());
        return instance;
    }
}

class HistoryContainer {
    constructor() {
        this.items = [];
    }

    log(message, dict = null) {
        let count = this.items.length;
        let item = HistoryItem.create();
        item.id = count;
        item.message = message;
        if (dict) {
            item.dict = dict;
        }
        this.items.push(item);
    }

    print() {
        console.log('History:');
        this.items.forEach((item, index) => {
            console.log(`${index + 1}: ${item}`);
        });
    }

    toJSON() {
        return this.items;
    }
}

class PageController {
    constructor() {
        this.history = new HistoryContainer();
        this.db = null;
        this.theme = null;

        // Create URLSearchParams object
        let urlParams = new URLSearchParams(window.location.search);

        // Get the 'task' parameter
        let urlParamTask = urlParams.get('task');

        // If 'task' parameter exists, decode it
        if (urlParamTask) {
            let decodedTask = decodeURIComponent(urlParamTask);
            console.log("Task:", decodedTask);
            this.taskId = decodedTask;

            document.title = decodedTask;

            document.getElementById('title_task').innerText = decodedTask;
        } else {
            this.taskId = null;
            console.error("URLSearchParams does not contain 'task' parameter.");
        }

        // Get the 'dataset' parameter
        let urlParamDataset = urlParams.get('dataset');

        // If 'dataset' parameter exists, decode it
        if (urlParamDataset) {
            let decodedDataset = decodeURIComponent(urlParamDataset);
            console.log("Dataset:", decodedDataset);
            this.datasetId = decodedDataset;
        } else {
            this.datasetId = 'ARC';
            console.error("URLSearchParams does not contain 'dataset' parameter.");
        }

        // Assign link to "Back button", so it preserves the URL parameters.
        {
            let urlParams2 = new URLSearchParams(window.location.search);
            urlParams2.delete('task');

            let url = `.?` + urlParams2.toString();
            let el = document.getElementById('link-to-tasks-page');
            el.href = url;
            console.log('setting back button url:', el.href);
        }

        if (enableFullscreenMode()) {
            let el = document.getElementById('fullscreen-button');
            el.classList.remove('hidden');
        }

        this.drawCanvas = document.getElementById('draw-canvas');
        this.pasteCanvas = document.getElementById('paste-canvas');
        this.isDrawing = false;
        this.currentColor = 0;
        this.currentTest = 0;
        this.currentTool = 'paint';
        this.numberOfTests = 1;
        this.drawingItems = [];
        this.inset = 2;
        this.clipboard = null;
        this.isPasteMode = false;
        this.isPasting = false;
        this.pasteX = 0;
        this.pasteY = 0;

        this.enablePlotDraw = false;

        let maxPixelSize = 100;
        this.maxPixelSize = maxPixelSize;
        this.image = ARCImage.color(maxPixelSize, maxPixelSize, 0);

        this.isFullscreen = false;
        this.isGridVisible = PageController.getItemIsGridVisible();

        this.overviewRevealSolutions = false;

        {
            // Select the radio button with the id 'tool_paint'
            // Sometimes the browser remembers the last selected radio button, across sessions.
            // This code makes sure that the 'tool_paint' radio button is always selected on launch.
            document.getElementById('tool_paint').checked = true;
        }
    }

    async onload() {
        Theme.assignBodyClassName();
        this.theme = Theme.themeFromBody();
        
        this.db = await DatabaseWrapper.create();
        console.log('PageController.onload()', this.db);
        await this.loadTask();
        this.history.log('loaded task');
        this.addEventListeners();
        this.hideEditorShowOverview();
        // await this.replayExampleHistoryFile();
    }

    async replayExampleHistoryFile() {
        const response = await fetch('history1.json');
        // console.log('response:', response);
        const arrayBuffer = await response.arrayBuffer();
        let uint8Array = new Uint8Array(arrayBuffer);
        let jsonString = new TextDecoder().decode(uint8Array);
        this.replayHistoryFile(jsonString);
    }

    addEventListeners() {
        // Add an event listener to resize the canvas whenever the window is resized
        window.addEventListener('resize', () => { this.resizeOrChangeOrientation(); });
        window.addEventListener('orientationchange', () => { this.resizeOrChangeOrientation(); });

        // Interaction with the draw canvas
        this.drawCanvas.addEventListener('touchstart', (event) => { this.startDraw(event); }, false);
        this.drawCanvas.addEventListener('touchmove', (event) => { this.moveDraw(event); }, false);
        this.drawCanvas.addEventListener('touchend', (event) => { this.stopDraw(event); }, false);
        this.drawCanvas.addEventListener('mousedown', (event) => { this.startDraw(event); }, false);
        this.drawCanvas.addEventListener('mousemove', (event) => { this.moveDraw(event); }, false);
        this.drawCanvas.addEventListener('mouseup', (event) => { this.stopDraw(event); }, false);
        this.drawCanvas.addEventListener('mouseout', (event) => { this.stopDraw(event); }, false);

        // Interaction with the paste canvas
        this.pasteCanvas.addEventListener('touchstart', (event) => { this.startPaste(event); }, false);
        this.pasteCanvas.addEventListener('touchmove', (event) => { this.movePaste(event); }, false);
        this.pasteCanvas.addEventListener('touchend', (event) => { this.stopPaste(event); }, false);
        this.pasteCanvas.addEventListener('mousedown', (event) => { this.startPaste(event); }, false);
        this.pasteCanvas.addEventListener('mousemove', (event) => { this.movePaste(event); }, false);
        this.pasteCanvas.addEventListener('mouseup', (event) => { this.stopPaste(event); }, false);
        this.pasteCanvas.addEventListener('mouseout', (event) => { this.stopPaste(event); }, false);

        // Listen for the keyup event
        window.addEventListener('keyup', (event) => { this.keyUp(event); });
        
        document.addEventListener("fullscreenchange", (event) => {
            if (document.fullscreenElement) {
                console.log(`Element: ${document.fullscreenElement.id} entered full-screen mode.`);
                this.isFullscreen = true;
            } else {
                console.log('Leaving full-screen mode.');
                this.isFullscreen = false;
            }
        });

        // Get all radio buttons with the name 'tool_switching'
        var radios = document.querySelectorAll('input[name="tool_switching"]');
        radios.forEach(radio => {
            radio.addEventListener('change', () => {
                // This function is called whenever a radio button is selected
                if(radio.checked) {
                    this.didPickTool(radio.value);
                }
            });
        });
    }

    resizeOrChangeOrientation() {
        resizeCanvas();
        if (this.isOverviewHidden()) {
            this.updateDrawCanvas();
        } else {
            this.updateOverview();
        }
    }

    keyboardShortcutPickTool(radioButtonId) {
        let el = document.getElementById(radioButtonId);
        el.checked = true;
        this.didPickTool(el.value);
        this.hideToolPanel();
    }

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

        if (this.isPasteMode) {
            // While the paste canvas is visible, only the 'Enter' key is handled.
            // All other keyboard interactions are ignored.
            if (event.code === 'Enter') {
                this.pasteFromClipboardAccept();
            }
            return;
        }

        if (event.code === 'KeyF') {
            if (enableFullscreenMode()) {
                this.toggleFullscreen();
            }
        }
        if (event.code === 'KeyG') {
            this.toggleGrid();
        }
        if (event.code === 'KeyO') {
            this.toggleOverview();
        }

        if (this.isEditorShownAndPasteModeFalse()) {
            // Only while the "editor" is visible, and no paste layer is active, the following keys are handled.

            if (event.code === 'KeyZ' && event.ctrlKey) {
                if (event.shiftKey) {
                    this.redoAction();
                } else {
                    this.undoAction();
                }
            }
            if (event.code === 'KeyC') {
                this.copyToClipboard();
            }
            if (event.code === 'KeyV') {
                this.pasteFromClipboard();
            }
            if (event.code === 'KeyP') {
                this.keyboardShortcutPickTool('tool_paint');
            }
            if (event.code === 'KeyS') {
                this.keyboardShortcutPickTool('tool_select');
            }
            if (event.code === 'KeyL') {
                this.keyboardShortcutPickTool('tool_fill');
            }
            if (event.code === 'ArrowUp') {
                this.moveUp();
            }
            if (event.code === 'ArrowDown') {
                this.moveDown();
            }
            if (event.code === 'ArrowLeft') {
                this.moveLeft();
            }
            if (event.code === 'ArrowRight') {
                this.moveRight();
            }
            if (event.code === 'KeyQ') {
                this.replay();
            }
        }
    }

    didPickTool(toolId) {
        console.log('Selected Tool:', toolId);
        let el = document.getElementById('tool-button');
        el.innerText = `Tool: ${toolId}`;
        this.currentTool = toolId;
        this.updateDrawCanvas();
        this.hideToolPanel();

        let el1 = document.getElementById('crop-selected-rectangle-button');
        if (this.isCurrentToolSelect()) {
            el1.classList.remove('hidden');
        } else {
            el1.classList.add('hidden');
        }
    }

    undoAction() {
        console.log('Undo action');
        let drawingItem = this.currentDrawingItem();
        drawingItem.caretaker.undo(drawingItem.originator);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    redoAction() {
        console.log('Redo action');
        let drawingItem = this.currentDrawingItem();
        drawingItem.caretaker.redo(drawingItem.originator);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    getPosition(event) {
        let rect = this.drawCanvas.getBoundingClientRect();
        var x, y;
        // Check if it's a touch event
        if (event.touches) {
            x = event.touches[0].clientX - rect.left;
            y = event.touches[0].clientY - rect.top;
        } else { // Mouse event
            x = event.clientX - rect.left;
            y = event.clientY - rect.top;
        }
        return { x: x, y: y };
    }

    translateCoordinatesToSecondCanvas(firstCanvas, secondCanvas, x, y) {
        // Get bounding rectangles of both canvases
        let rectFirst = firstCanvas.getBoundingClientRect();
        let rectSecond = secondCanvas.getBoundingClientRect();
    
        // Calculate the difference in position between the two canvases
        let deltaX = rectSecond.left - rectFirst.left;
        let deltaY = rectSecond.top - rectFirst.top;
    
        // If the canvases have different scales, calculate the scale factors
        // (For example, if they have different dimensions but display the same content)
        let scaleX = secondCanvas.width / rectSecond.width;
        let scaleY = secondCanvas.height / rectSecond.height;
    
        // Adjust the coordinates
        let newX = (x + deltaX) * scaleX;
        let newY = (y + deltaY) * scaleY;
    
        return { x: newX, y: newY };
    }

    startPaste(event) {
        if(!this.isPasteMode) {
            console.error('Paste mode is not active, startPaste() should not be called.');
            return;
        }

        event.preventDefault();
        this.isPasting = true;
        let position = this.getPosition(event);

        this.pasteX = position.x;
        this.pasteY = position.y;
        // console.log('Paste mode. x:', this.pasteX, 'y:', this.pasteY);
        this.updateDrawCanvas();
    }

    movePaste(event) {
        if(!this.isPasteMode) {
            console.error('Paste mode is not active, movePaste() should not be called.');
            return;
        }
        if(!this.isPasting) {
            return;
        }

        event.preventDefault();
        let position = this.getPosition(event);

        this.pasteX = position.x;
        this.pasteY = position.y;
        // console.log('Paste mode. x:', this.pasteX, 'y:', this.pasteY);
        this.updateDrawCanvas();
    }

    stopPaste(event) {
        event.preventDefault();
        this.isPasting = false;
    }

    startDraw(event) {
        event.preventDefault();
        this.isDrawing = true;
        var ctx = this.drawCanvas.getContext('2d');
        let position = this.getPosition(event);

        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageRef();

        if (this.enablePlotDraw) {
            let plotSize = 5;
            ctx.fillStyle = 'white';
            ctx.fillRect(position.x, position.y, plotSize, plotSize);
        }

        if(this.isPasteMode) {
            this.pasteX = position.x;
            this.pasteY = position.y;
            // console.log('Paste mode. x:', this.pasteX, 'y:', this.pasteY);
            this.updateDrawCanvas();
            return;
        }

        let width = this.drawCanvas.width - this.inset * 2;
        let height = this.drawCanvas.height - this.inset * 2;
        let cellSize = originalImage.cellSize(width, height);

        const drawX = this.inset;
        const drawY = this.inset;
        const innerWidth = cellSize * originalImage.width;
        const innerHeight = cellSize * originalImage.height;
        let x0 = Math.floor(drawX + (width - innerWidth) / 2);
        var y0 = Math.floor(drawY + (height - innerHeight) / 2);

        let cellx = Math.floor((position.x-x0)/cellSize);
        let celly = Math.floor((position.y-y0)/cellSize);
        // console.log('cellx', cellx, 'celly', celly);

        if(this.currentTool == 'select') {
            let clampedCellX = Math.max(0, Math.min(cellx, originalImage.width - 1));
            let clampedCellY = Math.max(0, Math.min(celly, originalImage.height - 1));
            drawingItem.selectRectangle.x0 = clampedCellX;
            drawingItem.selectRectangle.y0 = clampedCellY;
            drawingItem.selectRectangle.x1 = clampedCellX;
            drawingItem.selectRectangle.y1 = clampedCellY;
            this.updateDrawCanvas();
            return;
        }

        if (cellx < 0 || cellx >= originalImage.width) {
            return;
        }
        if (celly < 0 || celly >= originalImage.height) {
            return;
        }
        if(this.currentTool == 'paint') {
            this.setPixel(cellx, celly, this.currentColor);
        }
        if(this.currentTool == 'fill') {
            this.floodFill(cellx, celly, this.currentColor);
        }
    }

    moveDraw(event) {
        event.preventDefault();
        if (!this.isDrawing) {
            return;
        }
        var ctx = this.drawCanvas.getContext('2d');
        let position = this.getPosition(event);
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageRef();

        if (this.enablePlotDraw) {
            let plotSize = 5;
            ctx.fillStyle = 'grey';
            ctx.fillRect(position.x, position.y, plotSize, plotSize);
        }

        if(this.isPasteMode) {
            this.pasteX = position.x;
            this.pasteY = position.y;
            // console.log('Paste mode. x:', this.pasteX, 'y:', this.pasteY);
            this.updateDrawCanvas();
            return;
        }

        let width = this.drawCanvas.width - this.inset * 2;
        let height = this.drawCanvas.height - this.inset * 2;
        let cellSize = originalImage.cellSize(width, height);

        const drawX = this.inset;
        const drawY = this.inset;
        const innerWidth = cellSize * originalImage.width;
        const innerHeight = cellSize * originalImage.height;
        let x0 = Math.floor(drawX + (width - innerWidth) / 2);
        var y0 = Math.floor(drawY + (height - innerHeight) / 2);

        let cellx = Math.floor((position.x-x0)/cellSize);
        let celly = Math.floor((position.y-y0)/cellSize);
        // console.log('cellx', cellx, 'celly', celly);
        if(this.currentTool == 'select') {
            let clampedCellX = Math.max(0, Math.min(cellx, originalImage.width - 1));
            let clampedCellY = Math.max(0, Math.min(celly, originalImage.height - 1));
            drawingItem.selectRectangle.x1 = clampedCellX;
            drawingItem.selectRectangle.y1 = clampedCellY;
            this.updateDrawCanvas();
            return;
        }

        if (cellx < 0 || cellx >= originalImage.width) {
            return;
        }
        if (celly < 0 || celly >= originalImage.height) {
            return;
        }
        if(this.currentTool == 'paint') {
            this.setPixel(cellx, celly, this.currentColor);
        }
    }

    stopDraw(event) {
        event.preventDefault();
        this.isDrawing = false;
        // var ctx = this.drawCanvas.getContext('2d');
        // let cellSize = 100;
        // ctx.fillStyle = 'white';
        // ctx.fillRect(0, 0, cellSize, cellSize);
    }

    setPixel(x, y, color) {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        var image = originalImage.clone();
        try {
            image.setPixel(x, y, color);
        } catch (error) {
            console.error('Error setting pixel', error);
            return;
        }
        if (image.isEqualTo(originalImage)) {
            // console.log('The image is the same after setPixel.');
            let message = `set pixel x: ${x} y: ${y} color: ${color}, no change to image`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'set pixel',
                what: what,
                modified: 'none',
                x: x,
                y: y,
                color: color,
                image: image.pixels,
            });
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'set pixel');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();

        let message = `set pixel x: ${x} y: ${y} color: ${color}, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'set pixel',
            what: what,
            modified: 'image',
            x: x,
            y: y,
            color: color,
            image: image.pixels,
        });
    }

    floodFill(x, y, color) {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        var image = originalImage.clone();
        image.floodFill(x, y, color);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after floodFill.');

            let message = `flood fill x: ${x} y: ${y} color: ${color}, no change to image`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'flood fill',
                what: what,
                modified: 'none',
                x: x,
                y: y,
                color: color,
                image: image.pixels,
            });
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'flood fill');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();

        let message = `flood fill x: ${x} y: ${y} color: ${color}, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'flood fill',
            what: what,
            modified: 'image',
            x: x,
            y: y,
            color: color,
            image: image.pixels,
        });
    }

    pickColor(colorValue) {
        var paletteItems = document.querySelectorAll('#palette > div');
        paletteItems.forEach((item) => {
            item.classList.remove('palette_item_selected');
        });

        // Select the clicked color
        var selectedColor = document.getElementById('palette-item' + colorValue);
        selectedColor.classList.add('palette_item_selected');

        let isSameColor = this.currentColor === colorValue;
        this.currentColor = colorValue;

        if (this.isCurrentToolSelect()) {
            this.fillSelectedRectangle();
            return;
        }        

        if (isSameColor) {
            let message = `pick color ${colorValue}, no change to current color`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'pick color',
                what: what,
                modified: 'none',
                color: colorValue,
            });
        } else {
            let message = `pick color ${colorValue}, modified current color`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'pick color',
                what: what,
                modified: 'color',
                color: colorValue,
            });
        }
    }

    fillSelectedRectangle() {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let { minX, maxX, minY, maxY } = drawingItem.getSelectedRectangleCoordinates();
        if (minX > maxX || minY > maxY) {
            return;
        }
        if (minX < 0 || maxX >= originalImage.width) {
            return;
        }
        if (minY < 0 || maxY >= originalImage.height) {
            return;
        }
        var image = originalImage.clone();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                image.pixels[y][x] = this.currentColor;
            }
        }
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after filling the selection.');

            let message = `fill selection minX: ${minX} minY: ${minY} maxX: ${maxX} maxY: ${maxY} color: ${color}, no change to image`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'fill selection',
                what: what,
                modified: 'none',
                minX: minX,
                minY: minY,
                maxX: maxX,
                maxY: maxY,
                color: color,
                image: image.pixels,
            });
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'fill selection');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();

        let message = `fill selection minX: ${minX} minY: ${minY} maxX: ${maxX} maxY: ${maxY} color: ${color}, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'fill selection',
            what: what,
            modified: 'image',
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY,
            color: color,
            image: image.pixels,
        });
    }

    async loadTask() {
        console.log('PageController.loadBundle()');

        var dataset = null;
        try {
            dataset = await Dataset.load(this.db, this.datasetId);
        } catch (error) {
            console.error('Error loading bundle', error);
            return;
        }
        if (!dataset) {
            console.error('Error there is no dataset.');
            return;
        }

        let task = dataset.findTask(this.taskId);
        if(!task) {
            console.error('Error there is no task.');
            return;
        }
        this.task = task;
        this.numberOfTests = task.test.length;

        if (this.numberOfTests < 1) {
            console.error('Error there are no tests. Expected 1 or more test pairs.');
        }
        var drawingItems = [];
        for (let i = 0; i < this.numberOfTests; i++) {
            let inputImage = task.test[i].input.clone();
            let item = new DrawingItem();
            item.id = i;
            item.originator.setImage(inputImage);
            item.assignSelectRectangleFromCurrentImage();
            drawingItems.push(item);
        }
        this.drawingItems = drawingItems;
        if (this.drawingItems.length < 1) {
            console.error('Error there are no drawing items. Cannot make use of the first drawing item! currentDrawingItem() will fail.');
        }

        this.showTask(task);
        this.updateDrawCanvas();
    }

    currentDrawingItem() {
        let testIndex = this.currentTest % this.numberOfTests;
        if (testIndex < 0 || testIndex >= this.drawingItems.length) {
            throw new Error(`Error drawingItemForCurrentTest() testIndex: ${testIndex} is out of range. currentTest: ${this.currentTest} numberOfTests: ${this.numberOfTests}`);
        }
        return this.drawingItems[testIndex];
    }

    inputImageFromCurrentTest() {
        let testIndex = this.currentTest % this.numberOfTests;
        let image = this.task.test[testIndex].input;
        return image.clone();
    }

    showTask(task) {
        console.log('Show task:', task);

        this.updateOverview();
    }

    calcCellSizeForOverview(task, dpr, showSizeAndGrid) {
        let el = document.getElementById('main-inner');
        let width = el.clientWidth;
        let height = el.clientHeight;
        // console.log('calcCellSizeForOverview() width:', width, 'height:', height);

        let heightOfNonImage = showSizeAndGrid ? 140 : 80;
        let separatorWidth = 10;
        let paddingWidth = (task.train.length + task.test.length) * 20;
        let widthOfNonImage = separatorWidth + paddingWidth;

        let separatorSize = 1;
        var sumPixelWidth = 0;
        for (let i = 0; i < task.train.length; i++) {
            let input = task.train[i].input;
            let output = task.train[i].output;
            sumPixelWidth += Math.max(input.width, output.width);
        }
        for (let i = 0; i < task.test.length; i++) {
            let input = task.test[i].input;
            var output = this.imageForTestIndex(i);
            if (!output) {
                output = input;
            }
            sumPixelWidth += Math.max(input.width, output.width);
        }
        sumPixelWidth += separatorSize * (task.train.length + task.test.length - 1);

        var maxPixelHeight = 0;
        for (let i = 0; i < task.train.length; i++) {
            let input = task.train[i].input;
            let output = task.train[i].output;
            let pixelHeight = input.height + output.height + separatorSize;
            maxPixelHeight = Math.max(maxPixelHeight, pixelHeight);
        }
        for (let i = 0; i < task.test.length; i++) {
            let input = task.test[i].input;
            var output = this.imageForTestIndex(i);
            if (!output) {
                output = input;
            }
            let pixelHeight = input.height + output.height;
            maxPixelHeight = Math.max(maxPixelHeight, pixelHeight);
        }

        let cellSizeX = Math.floor((width - widthOfNonImage) * dpr / sumPixelWidth);
        let cellSizeY = Math.floor((height - heightOfNonImage) * dpr / maxPixelHeight);
        let cellSize = Math.min(cellSizeX, cellSizeY);
        // console.log('calcCellSizeForOverview() cellSize:', cellSize, 'cellSizeX:', cellSizeX, 'cellSizeY:', cellSizeY, 'sumPixelWidth:', sumPixelWidth, 'maxPixelHeight:', maxPixelHeight);
        return cellSize;
    }

    // The user is pressing down the button that reveals the solutions.
    overviewRevealSolutionsYes() {
        this.overviewRevealSolutions = true;
        this.updateOverview();
    }

    // The user is releasing the button that reveals the solutions.
    overviewRevealSolutionsNo() {
        this.overviewRevealSolutions = false;
        this.updateOverview();
    }

    // Rebuild the overview table, so it shows what the user has drawn so far.
    updateOverview() {
        // Get the device pixel ratio, falling back to 1.
        let devicePixelRatio = window.devicePixelRatio || 1;
        // let devicePixelRatio = 1;
        // console.log('devicePixelRatio:', devicePixelRatio);

        let task = this.task;
        let showSizeAndGrid = this.isGridVisible;
        let cellSize = this.calcCellSizeForOverview(task, devicePixelRatio, showSizeAndGrid);
        // console.log('cellSize:', cellSize);
        cellSize = cellSize / devicePixelRatio;

        let el_tr0 = document.getElementById('task-overview-table-row0');
        let el_tr1 = document.getElementById('task-overview-table-row1');
        let el_tr2 = document.getElementById('task-overview-table-row2');

        // Remove all children
        el_tr0.innerText = '';
        el_tr1.innerText = '';
        el_tr2.innerText = '';

        // Populate table for `train` pairs.
        for (let i = 0; i < task.train.length; i++) {
            let input = task.train[i].input;
            let output = task.train[i].output;
            let el_td0 = document.createElement('td');
            let el_td1 = document.createElement('td');
            let el_td2 = document.createElement('td');
            // el_td0.innerText = `Train ${i + 1}`;
            // el_td1.innerText = `Input ${i + 1}`;
            // el_td2.innerText = `Output ${i + 1}`;

            {
                el_td0.classList.add('center-x');
                el_td0.innerText = `${i + 1}`;
            }

            {
                el_td1.classList.add('input-image-cell');
                el_td1.classList.add('center-x');

                let el_div = document.createElement('div');
                el_div.className = 'image-size-label';
                el_div.innerText = `${input.width}x${input.height}`;
                if (showSizeAndGrid) {
                    el_td1.appendChild(el_div);
                }

                let canvas = input.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                el_td1.appendChild(canvas);
            }

            {
                el_td2.classList.add('output-image-cell');
                el_td2.classList.add('center-x');

                let canvas = output.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                el_td2.appendChild(canvas);

                let el_div = document.createElement('div');
                el_div.className = 'image-size-label';
                el_div.innerText = `${output.width}x${output.height}`;
                if (showSizeAndGrid) {
                    el_td2.appendChild(el_div);
                }
            }
            el_tr0.appendChild(el_td0);
            el_tr1.appendChild(el_td1);
            el_tr2.appendChild(el_td2);
        }

        // Separate the `train` pairs and the `test` pairs.
        {
            let el_td0 = document.createElement('td');
            el_td0.innerHTML = '&nbsp;';
            el_td0.classList.add('seperator-column');
            el_td0.rowSpan = 3;
            el_tr0.appendChild(el_td0);
        }

        // Populate table for `test` pairs.
        for (let i = 0; i < task.test.length; i++) {
            let input = task.test[i].input;
            let output = task.test[i].output;
            let el_td0 = document.createElement('td');
            let el_td1 = document.createElement('td');
            let el_td2 = document.createElement('td');
            // el_td0.innerText = `Test ${i + 1}`;
            // el_td1.innerText = `Input ${i + 1}`;
            // el_td2.innerText = `Output ${i + 1}`;

            if (i == this.currentTest) {
                el_td0.classList.add('active-test');
                el_td1.classList.add('active-test');
                el_td2.classList.add('active-test');
                let handler = () => {
                    this.hideOverviewShowEditor();
                };
                el_td0.onpointerdown = handler;
                el_td1.onpointerdown = handler;
                el_td2.onpointerdown = handler;
            } else {
                el_td0.classList.add('click-to-active-test');
                el_td1.classList.add('click-to-active-test');
                el_td2.classList.add('click-to-active-test');
                let handler = () => {
                    this.activateTestIndex(i);
                };
                el_td0.onpointerdown = handler;
                el_td1.onpointerdown = handler;
                el_td2.onpointerdown = handler;
            }

            {
                el_td0.classList.add('center-x');
                el_td0.innerText = `${i + 1}`;
            }

            {
                el_td1.classList.add('input-image-cell');
                el_td1.classList.add('center-x');

                let el_div = document.createElement('div');
                el_div.className = 'image-size-label';
                el_div.innerText = `${input.width}x${input.height}`;
                if (showSizeAndGrid) {
                    el_td1.appendChild(el_div);
                }

                let canvas = input.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                el_td1.appendChild(canvas);
            }

            {
                el_td2.classList.add('output-image-cell');
                el_td2.classList.add('center-x');
                el_td2.classList.add('test-output-cell');

                var image = null;
                if (this.drawingItems[i].caretaker.undoList.length > 0) {
                    // Only show an image when the user have drawn something.
                    // If there are no actions to undo, then the user have not drawn anything.
                    image = this.drawingItems[i].originator.getImageRef();
                }
                if (this.overviewRevealSolutions) {
                    // The user is holding down the button that reveals the solutions.
                    image = output;
                }
                if (!image) {
                    el_td2.innerText = '?';
                } else {

                    let canvas = image.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                    el_td2.appendChild(canvas);
    
                    let el_div = document.createElement('div');
                    el_div.className = 'image-size-label';
                    el_div.innerText = `${image.width}x${image.height}`;
                    if (showSizeAndGrid) {
                        el_td2.appendChild(el_div);
                    }
                }
    
            }
            el_tr0.appendChild(el_td0);
            el_tr1.appendChild(el_td1);
            el_tr2.appendChild(el_td2);
        }
    }

    isCurrentToolSelect() {
        return this.currentTool == 'select';
    }

    updateDrawCanvas() {
        let isSelectTool = this.isCurrentToolSelect();

        const ctx = this.drawCanvas.getContext('2d');

        let canvasWidth = this.drawCanvas.width;
        let canvasHeight = this.drawCanvas.height;
        let inset = this.inset;
        let width = canvasWidth - inset * 2;
        let height = canvasHeight - inset * 2;

        // Clear the canvas to be fully transparent
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        let drawingItem = this.currentDrawingItem();
        let image = drawingItem.originator.getImageRef();
        let cellSize = image.cellSize(width, height);

        let gapSize = this.isGridVisible ? 1 : 0;

        // Draw an outline around the image
        {
            let x = image.calcX0(0, width, cellSize) + inset - 1;
            let y = image.calcY0(0, height, cellSize) + inset - 1;
            let w = image.width * cellSize + 2 - gapSize;
            let h = image.height * cellSize + 2 - gapSize;
            ctx.fillStyle = '#555';
            ctx.fillRect(x, y, w, h);
        }

        // Draw the image
        let options = {
            gapSize: gapSize,
        };
        image.draw(this.theme, ctx, inset, inset, width, height, cellSize, options);

        // Draw the dashed select rectangle
        if (isSelectTool && !this.isPasteMode) {
            let { minX, maxX, minY, maxY } = drawingItem.getSelectedRectangleCoordinates();
            // console.log('minX', minX, 'maxX', maxX, 'minY', minY, 'maxY', maxY);

            let x = image.calcX0(0, width, cellSize) + minX * cellSize + inset;
            let y = image.calcY0(0, height, cellSize) + minY * cellSize + inset;
            // console.log('x', x, 'y', y);
    
            let drawWidth = (maxX - minX + 1) * cellSize;
            let drawHeight = (maxY - minY + 1) * cellSize;

            this.drawDashedRectangle(ctx, x, y, drawWidth, drawHeight);
        }

        if (this.isPasteMode) {
            if (this.clipboard) {
                const ctx2 = this.pasteCanvas.getContext('2d');
                ctx2.clearRect(0, 0, this.pasteCanvas.width, this.pasteCanvas.height);

                let pasteX = this.pasteX;
                let pasteY = this.pasteY;
                let clipboardImage = this.clipboard;
                let halfWidth = Math.floor(clipboardImage.width * cellSize / 2);
                let halfHeight = Math.floor(clipboardImage.height * cellSize / 2);
                let minXRaw = pasteX - halfWidth;
                let minYRaw = pasteY - halfHeight;
                let position2 = this.translateCoordinatesToSecondCanvas(this.pasteCanvas, this.drawCanvas, minXRaw, minYRaw);
                let drawX = Math.floor(position2.x);
                let drawY = Math.floor(position2.y);
                ctx.globalAlpha = 0.75;
                clipboardImage.drawInner(this.theme, ctx2, drawX, drawY, cellSize, gapSize);
                ctx.globalAlpha = 1;

                let x0 = image.calcX0(0, width, cellSize) + inset;
                let y0 = image.calcY0(0, height, cellSize) + inset;

                var minX = Math.floor((pasteX - halfWidth - x0) / cellSize + 0.5);
                var minY = Math.floor((pasteY - halfHeight - y0) / cellSize + 0.5);
                var maxX = minX + clipboardImage.width - 1;
                var maxY = minY + clipboardImage.height - 1;

                minX = Math.max(0, minX);
                minY = Math.max(0, minY);
                maxX = Math.min(image.width - 1, maxX);
                maxY = Math.min(image.height - 1, maxY);
    
                let x = image.calcX0(minX * cellSize + inset, width, cellSize);
                let y = image.calcY0(minY * cellSize + inset, height, cellSize);
        
                let drawWidth = (maxX - minX + 1) * cellSize;
                let drawHeight = (maxY - minY + 1) * cellSize;
                if (drawWidth > 0 && drawHeight > 0) {
                    this.drawDashedRectangle(ctx, x, y, drawWidth, drawHeight);
                }
            }
        }
    }

    drawDashedRectangle(ctx, x, y, width, height) {
        // First draw a solid white rectangle
        ctx.beginPath();
        ctx.setLineDash([]);
        ctx.strokeStyle = 'white';
        ctx.lineWidth = 2;
        ctx.rect(x - 1, y - 1, width, height);
        ctx.stroke();

        // Then draw a dashed black rectangle
        ctx.beginPath();
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.rect(x - 1, y - 1, width, height);
        ctx.stroke();    
    }

    isEditorShownAndPasteModeFalse() {
        if (!this.isOverviewHidden()) {
            // The overview is visible, the editor is hidden.
            return false;
        }
        if (this.isPasteMode) {
            // The paste canvas is visible on top of the editor.
            return false;
        }
        // The editor is visible.
        // The paste canvas is hidden.
        // The overview is hidden.
        return true;
    }

    isOverviewHidden() {
        let el = document.getElementById("task-overview");
        return el.classList.contains('hidden');
    }

    toggleOverview() {
        if (this.isOverviewHidden()) {
            this.hideEditorShowOverview();
        } else {
            this.hideOverviewShowEditor();
        }
    }

    hideOverviewShowEditor() {
        let el0 = document.getElementById("task-overview");
        let el1 = document.getElementById("page-footer-overview-mode");
        let el2 = document.getElementById("draw-area-outer");
        let el3 = document.getElementById("page-footer-draw-mode");
        el0.classList.add('hidden');
        el1.classList.add('hidden');
        el2.classList.remove('hidden');
        el3.classList.remove('hidden');

        // Sometimes the browser doesn't render the <canvas> after it's hidden and shown again.
        resizeCanvas();
        this.updateDrawCanvas();
    }

    hideEditorShowOverview() {
        let el0 = document.getElementById("task-overview");
        let el1 = document.getElementById("page-footer-overview-mode");
        let el2 = document.getElementById("draw-area-outer");
        let el3 = document.getElementById("page-footer-draw-mode");
        el0.classList.remove('hidden');
        el1.classList.remove('hidden');
        el2.classList.add('hidden');
        el3.classList.add('hidden');

        this.updateOverview();
    }

    toggleFullscreen() {
        if (this.isFullscreen) {
            const cancelFullScreen = document.exitFullscreen || document.mozCancelFullScreen || document.webkitExitFullscreen || document.msExitFullscreen;
            cancelFullScreen.call(document);
            this.isFullscreen = false;
            return;
        }
        if (document.documentElement.requestFullscreen) {
            document.documentElement.requestFullscreen();
            this.isFullscreen = true;
        } else if (document.documentElement.webkitRequestFullscreen) { // Safari specific
            document.documentElement.webkitRequestFullscreen();
            this.isFullscreen = true;
        } else {
            // Fullscreen API is not supported
            alert("Fullscreen mode is not supported in your browser.");
        }
    }

    static gridKey() {
        return 'grid-visible';
    }

    static getItemIsGridVisible() {
        let rawValue = localStorage.getItem(PageController.gridKey());
        return rawValue == 'true';
    }

    toggleGrid() {
        this.isGridVisible = !this.isGridVisible;
        localStorage.setItem(PageController.gridKey(), this.isGridVisible);
        this.updateDrawCanvas();
        this.updateOverview();
    }

    submitDrawing() {
        console.log('Submit');
        let image = this.currentDrawingItem().originator.getImageRef();
        let json0 = JSON.stringify(image.pixels);

        let testIndex = this.currentTest % this.numberOfTests;
        let expectedImage = this.task.test[testIndex].output;
        let json1 = JSON.stringify(expectedImage.pixels);

        let isCorrect = json0 == json1;

        if (isCorrect) {
            let message = `submit, correct`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'submit',
                what: what,
                modified: 'none',
                correct: true,
                image: image.pixels,
            });
        } else {
            let message = `submit, incorrect`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'submit',
                what: what,
                modified: 'none',
                correct: false,
                image: image.pixels,
            });
        }

        var el = null;
        if (isCorrect) {
            el = document.getElementById('submit-status-correct');
        } else {
            el = document.getElementById('submit-status-incorrect');
        }
        el.classList.remove('hidden');

        // Hide status after 3 seconds
        setTimeout(() => {
            el.classList.add('hidden');
        }, 3000);
    }

    imageForTestIndex(testIndex) {
        return this.drawingItems[testIndex].originator.getImageClone();
    }

    activateTestIndex(testIndex) {
        let value0 = this.currentTest;
        this.currentTest = testIndex % this.numberOfTests;
        let value1 = this.currentTest;
        console.log(`Activate test: ${value0} -> ${value1}`);
        this.updateOverview();
        this.updateDrawCanvas();
    }

    getWidthHeightFromTextfield() {
        let sizeInput = document.getElementById('canvas-size-input').value;
    
        // Split the string at 'x'
        let dimensions = sizeInput.split('x');
    
        if (dimensions.length != 2) {
            console.error('Invalid input format. Correct format: widthxheight');
            return null;
        }

        let width = parseInt(dimensions[0]);
        let height = parseInt(dimensions[1]);

        if (isNaN(width) || isNaN(height)) {
            console.error('Invalid input: width and height must be numbers.');
            return null;
        }
        if (width < 1 || height < 1) {
            console.error('Invalid input: width and height must be 1 or greater.');
            return null;
        }
        if (width > this.maxPixelSize || height > this.maxPixelSize) {
            console.error(`Invalid input: width and height must be less than or equal to ${this.maxPixelSize}.`);
            return null;
        }
        
        // Return width and height as an object
        return { width, height };
    }
    
    resizeImageOnKeyDown(event) {
        // Check if the key pressed is 'Enter'
        if (event.key === 'Enter' || event.keyCode === 13) {
            // Call the function you want to execute when Enter is pressed
            this.resizeImage();
        }
    }

    resizeImage() {
        let size = this.getWidthHeightFromTextfield();
        if (!size) {
            console.error('Unable to determine the size');
            return;
        }
        // console.log('Width:', size.width, 'Height:', size.height);

        // Resize the image, preserve the content.
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let emptyImage = ARCImage.color(size.width, size.height, this.currentColor);
        let image = emptyImage.overlay(originalImage, 0, 0);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after resize.');

            let message = `resize width: ${size.width} height: ${size.height} color: ${this.currentColor}, no change to image`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'resize',
                what: what,
                modified: 'none',
                width: size.width,
                height: size.height,
                color: this.currentColor,
                image: image.pixels,
            });

            this.hideToolPanel();
            return;
        }

        drawingItem.caretaker.saveState(drawingItem.originator, 'resize image');
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();

        let message = `resize width: ${size.width} height: ${size.height} color: ${this.currentColor}, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'resize',
            what: what,
            modified: 'image',
            width: size.width,
            height: size.height,
            color: this.currentColor,
            image: image.pixels,
        });
    }

    startOverWithInputImage() {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let inputImage = this.inputImageFromCurrentTest();
        if (originalImage.isEqualTo(inputImage)) {
            console.log('The image is the same as the input image.');
            return;
        }

        // show an alert: "Are you sure you want to start over with the input image?"
        // If the user clicks "OK", then reset the current image to the input image.
        // If the user clicks "Cancel", then do nothing.
        let result = confirm('You have made changes to the image. Are you sure you want to start over with the input image?');
        console.log('startOverWithInputImage() result:', result);
        if (!result) {
            return;
        }

        console.log('startOverWithInputImage() confirmed');
        drawingItem.originator.setImage(inputImage);
        drawingItem.caretaker.clearHistory();
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();

        let message = `start over, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'start over',
            what: what,
            modified: 'image',
            image: inputImage.pixels,
        });
    }

    cropSelectedRectangle() {
        if (!this.isCurrentToolSelect()) {
            console.log('Crop is only available in select mode.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();

        let { minX, maxX, minY, maxY } = drawingItem.getSelectedRectangleCoordinates();
        // console.log('minX', minX, 'maxX', maxX, 'minY', minY, 'maxY', maxY);
        if (minX > maxX || minY > maxY) {
            return;
        }
        if (minX < 0 || maxX >= originalImage.width) {
            return;
        }
        if (minY < 0 || maxY >= originalImage.height) {
            return;
        }
        let image = originalImage.crop(minX, minY, maxX - minX + 1, maxY - minY + 1);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after crop.');

            let message = `crop minX: ${minX} minY: ${minY} maxX: ${maxX} maxY: ${maxY}, no change to image`;
            let what = `test ${this.currentTest} output`;
            this.history.log(message, {
                action: 'crop',
                what: what,
                modified: 'none',
                minX: minX,
                minY: minY,
                maxX: maxX,
                maxY: maxY,
                image: image.pixels,
            });

            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'crop selection');
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();

        let message = `crop minX: ${minX} minY: ${minY} maxX: ${maxX} maxY: ${maxY}, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'crop',
            what: what,
            modified: 'image',
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY,
            image: image.pixels,
        });
    }

    copyToClipboard() {
        let rectangle = this.getToolRectangle();
        let originalImage = this.currentDrawingItem().originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        this.clipboard = cropImage;
        this.hideToolPanel();
        console.log(`Copied to clipboard. width: ${cropImage.width}, height: ${cropImage.height}`);

        let message = `copy minX: ${minX} minY: ${minY} maxX: ${maxX} maxY: ${maxY}, modified clipboard`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'copy',
            what: what,
            modified: 'clipboard',
            minX: minX,
            minY: minY,
            maxX: maxX,
            maxY: maxY,
        });
    }

    pasteFromClipboard() {
        if (!this.clipboard) {
            console.log('Paste from clipboard. Clipboard is empty');
            return;
        }
        let image = this.clipboard;
        console.log(`Paste from clipboard. width: ${image.width}, height: ${image.height}`);
        this.pasteX = this.drawCanvas.width / 2;
        this.pasteY = this.drawCanvas.height / 2;
        this.hideToolPanel();
        this.isPasteMode = true;
        this.showPasteArea();
        resizeCanvas();
        this.updateDrawCanvas();
    }

    showPasteArea() {
        let el = document.getElementById('paste-area-outer');
        el.classList.remove('hidden');

        // When the paste layer is visible, there are two big buttons visible:
        // "Reject" - abort the paste operation.
        // "Accept" - confirm paste at the position. The keyboard shortcut is the "Enter" key.
        //
        // Firefox Desktop issue:
        // However if the user have previously clicked on another button beforehand,
        // then that previous button still has keyboard focus, and the "Enter" key performs a click on that previous button.
        // This is not what we want. We want the "Enter" key to perform a click on the "Accept" button.
        // Thus keyboard focus to the "Accept" button.
        document.getElementById('paste-area-accept-button').focus();
    }

    hidePasteArea() {
        let el = document.getElementById('paste-area-outer');
        el.classList.add('hidden');
    }

    pasteFromClipboardAccept() {
        if (!this.clipboard) {
            console.log('Paste from clipboard accept. Clipboard is empty');
            return;
        }
        if (!this.isPasteMode) {
            console.log('Paste from clipboard accept. Not in paste mode');
            return;
        }
        console.log('Paste from clipboard accept.');

        let canvasWidth = this.drawCanvas.width;
        let canvasHeight = this.drawCanvas.height;
        let inset = this.inset;
        let width = canvasWidth - inset * 2;
        let height = canvasHeight - inset * 2;

        let drawingItem = this.currentDrawingItem();
        let image = drawingItem.originator.getImageClone();

        let cellSize = image.cellSize(width, height);

        let pasteX = this.pasteX;
        let pasteY = this.pasteY;
        let clipboardImage = this.clipboard;
        let halfWidth = Math.floor(clipboardImage.width * cellSize / 2);
        let halfHeight = Math.floor(clipboardImage.height * cellSize / 2);

        let x0 = image.calcX0(0, width, cellSize) + inset;
        let y0 = image.calcY0(0, height, cellSize) + inset;

        var minX = Math.floor((pasteX - halfWidth - x0) / cellSize + 0.5);
        var minY = Math.floor((pasteY - halfHeight - y0) / cellSize + 0.5);

        let image2 = image.overlay(clipboardImage, minX, minY);
        this.isPasteMode = false;

        let clampedX0 = Math.max(0, Math.min(minX, image2.width - 1));
        let clampedY0 = Math.max(0, Math.min(minY, image2.height - 1));
        let clampedX1 = Math.max(0, Math.min(minX + clipboardImage.width - 1, image2.width - 1));
        let clampedY1 = Math.max(0, Math.min(minY + clipboardImage.height - 1, image2.height - 1));
        drawingItem.selectRectangle.x0 = clampedX0;
        drawingItem.selectRectangle.y0 = clampedY0;
        drawingItem.selectRectangle.x1 = clampedX1;
        drawingItem.selectRectangle.y1 = clampedY1;

        drawingItem.caretaker.saveState(drawingItem.originator, 'paste');
        drawingItem.originator.setImage(image2);

        this.updateDrawCanvas();
        this.hidePasteArea();

        let message = `paste accept minX: ${minX} minY: ${minY}, modified image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'paste accept',
            what: what,
            modified: 'image',
            minX: minX,
            minY: minY,
            image: image2.pixels,
        });
    }

    pasteFromClipboardReject() {
        console.log('Paste from clipboard reject.');
        this.isPasteMode = false;
        this.updateDrawCanvas();
        this.hidePasteArea();

        let message = `paste reject, no change to image`;
        let what = `test ${this.currentTest} output`;
        this.history.log(message, {
            action: 'paste reject',
            what: what,
            modified: 'none'
        });
    }

    // Get either the selected rectangle or the rectangle for the entire image
    getToolRectangle() {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageRef();
        if (this.isCurrentToolSelect()) {
            let { minX, maxX, minY, maxY } = drawingItem.getSelectedRectangleCoordinates();
            if (minX > maxX || minY > maxY) {
                throw new Error(`getToolRectangle. Invalid selected rectangle: min must be smaller than max. minX: ${minX}, maxX: ${maxX}, minY: ${minY}, maxY: ${maxY}`);
            }
            if (minX < 0 || maxX >= originalImage.width || minY < 0 || maxY >= originalImage.height) {
                throw new Error(`getToolRectangle. The selected rectangle is outside the image boundaries. minX: ${minX}, maxX: ${maxX}, minY: ${minY}, maxY: ${maxY}`);
            }
            return { 
                x: minX, 
                y: minY,
                width: maxX - minX + 1, 
                height: maxY - minY + 1 
            };
        } else {
            return { 
                x: 0, 
                y: 0, 
                width: originalImage.width, 
                height: originalImage.height 
            };
        }
    }

    // Reverse the x-axis of the selected rectangle or the entire image
    flipX() {
        let rectangle = this.getToolRectangle();
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let flippedImage = cropImage.flipX();
        let image = originalImage.overlay(flippedImage, rectangle.x, rectangle.y);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after flip x.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'flip x for selection or entire image');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Reverse the y-axis of the selected rectangle or the entire image
    flipY() {
        let rectangle = this.getToolRectangle();
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let flippedImage = cropImage.flipY();
        let image = originalImage.overlay(flippedImage, rectangle.x, rectangle.y);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after flip y.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'flip y for selection or entire image');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Rotate clockwise
    rotateCW() {
        if (this.isCurrentToolSelect()) {
            this.rotateCW_selection();
        } else {
            this.rotateCW_entireImage();
        }
    }

    rotateCW_selection() {
        let rectangle = this.getToolRectangle();
        if (rectangle.width != rectangle.height) {
            console.log('Rotate is only available for square selections.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let rotatedImage = cropImage.rotateCW();
        let image = originalImage.overlay(rotatedImage, rectangle.x, rectangle.y);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'rotate clockwise selection');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    rotateCW_entireImage() {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let image = originalImage.rotateCW();
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'rotate clockwise entire image');
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Rotate counter clockwise
    rotateCCW() {
        if (this.isCurrentToolSelect()) {
            this.rotateCCW_selection();
        } else {
            this.rotateCCW_entireImage();
        }
    }

    rotateCCW_selection() {
        let rectangle = this.getToolRectangle();
        if (rectangle.width != rectangle.height) {
            console.log('Rotate is only available for square selections.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let rotatedImage = cropImage.rotateCCW();
        let image = originalImage.overlay(rotatedImage, rectangle.x, rectangle.y);
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'rotate counter-clockwise selection');
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    rotateCCW_entireImage() {
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let image = originalImage.rotateCCW();
        if (image.isEqualTo(originalImage)) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'rotate counter-clockwise entire image');
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move left with wrap around
    moveLeft() {
        let rectangle = this.getToolRectangle();
        if (rectangle.width < 2) {
            console.log('Move is only available when the width is 2 or greater.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let image0 = originalImage.crop(rectangle.x, rectangle.y, 1, rectangle.height);
        let image1 = originalImage.crop(rectangle.x + 1, rectangle.y, rectangle.width - 1, rectangle.height);
        let image2 = originalImage.overlay(image1, rectangle.x, rectangle.y);
        let image3 = image2.overlay(image0, rectangle.x + rectangle.width - 1, rectangle.y);
        if (image3.isEqualTo(originalImage)) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'move left');
        drawingItem.originator.setImage(image3);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move right with wrap around
    moveRight() {
        let rectangle = this.getToolRectangle();
        if (rectangle.width < 2) {
            console.log('Move is only available when the width is 2 or greater.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let image0 = originalImage.crop(rectangle.x + rectangle.width - 1, rectangle.y, 1, rectangle.height);
        let image1 = originalImage.crop(rectangle.x, rectangle.y, rectangle.width - 1, rectangle.height);
        let image2 = originalImage.overlay(image1, rectangle.x + 1, rectangle.y);
        let image3 = image2.overlay(image0, rectangle.x, rectangle.y);
        if (image3.isEqualTo(originalImage)) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'move right');
        drawingItem.originator.setImage(image3);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move up with wrap around
    moveUp() {
        let rectangle = this.getToolRectangle();
        if (rectangle.height < 2) {
            console.log('Move is only available when the height is 2 or greater.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let image0 = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, 1);
        let image1 = originalImage.crop(rectangle.x, rectangle.y + 1, rectangle.width, rectangle.height - 1);
        let image2 = originalImage.overlay(image1, rectangle.x, rectangle.y);
        let image3 = image2.overlay(image0, rectangle.x, rectangle.y + rectangle.height - 1);
        if (image3.isEqualTo(originalImage)) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'move up');
        drawingItem.originator.setImage(image3);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move down with wrap around
    moveDown() {
        let rectangle = this.getToolRectangle();
        if (rectangle.height < 2) {
            console.log('Move is only available when the height is 2 or greater.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let originalImage = drawingItem.originator.getImageClone();
        let image0 = originalImage.crop(rectangle.x, rectangle.y + rectangle.height - 1, rectangle.width, 1);
        let image1 = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height - 1);
        let image2 = originalImage.overlay(image1, rectangle.x, rectangle.y + 1);
        let image3 = image2.overlay(image0, rectangle.x, rectangle.y);
        if (image3.isEqualTo(originalImage)) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, 'move down');
        drawingItem.originator.setImage(image3);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    showToolPanel() {
        {
            let originalImage = this.currentDrawingItem().originator.getImageRef();
            var el = document.getElementById('canvas-size-input');
            el.value = `${originalImage.width}x${originalImage.height}`;
        }
        {
            var el = document.getElementById('tool-panel');
            el.classList.remove('hidden');
        }
    }

    hideToolPanel() {
        var el = document.getElementById('tool-panel');
        el.classList.add('hidden');
    }

    dismissToolPanel(event) {
        let innerDiv = document.getElementById('tool-panel-inner');
    
        // Check if the click was outside the inner div
        if (event.target === innerDiv || innerDiv.contains(event.target)) {
            // Click inside, do nothing
        } else {
            // Click outside, dismiss the panel
            this.hideToolPanel();
        }
    }

    replay() {
        console.log('Replay start');
        let drawingItem = this.currentDrawingItem();
        // drawingItem.caretaker.printHistory();

        // History of all actions including the current state
        let undoListRef = drawingItem.caretaker.undoList;
        let undoList = Array.from(undoListRef);
        let actionName = 'replay';
        let currentState = drawingItem.originator.saveStateToMemento(actionName);
        undoList.push(currentState);

        let index = 0; // Start from the first item in the undo list
    
        // Show the replay area
        var el_outer = document.getElementById('replay-area-outer');
        el_outer.classList.remove('hidden');
        resizeCanvas();
    
        var el_canvas = document.getElementById('replay-canvas');
        var ctx = el_canvas.getContext('2d');
    
        // The undoList contains the history items
        const replayStep = () => {
            if (index >= undoList.length) {
                console.log('Replay finished');
                return; // Stop the replay if we've reached the end of the undo list
            }
            let mementoItem = undoList[index]; // Get the current item to be drawn
            index++; // Move to the next item for the next iteration
        
            // Clear the canvas for the next drawing state
            ctx.clearRect(0, 0, el_canvas.width, el_canvas.height);

            let image = mementoItem.state.image;
            let inset = 5;
            let width = el_canvas.width - inset * 2;
            let height = el_canvas.height - inset * 2;    
            let cellSize = image.cellSize(width, height);
            let gapSize = this.isGridVisible ? 1 : 0;
    
            // Draw an outline around the image
            {
                let x = image.calcX0(0, width, cellSize) + inset - 1;
                let y = image.calcY0(0, height, cellSize) + inset - 1;
                let w = image.width * cellSize + 2 - gapSize;
                let h = image.height * cellSize + 2 - gapSize;
                ctx.fillStyle = '#555';
                ctx.fillRect(x, y, w, h);
            }
            let options = {
                gapSize: gapSize,
            };
            image.draw(this.theme, ctx, inset, inset, width, height, cellSize, options);

            // Schedule the next step
            setTimeout(replayStep, 100);
        };
    
        replayStep(); // Start the replay loop
    }

    replay2(history_items) {
        console.log('Replay start');
        // let drawingItem = this.currentDrawingItem();
        // drawingItem.caretaker.printHistory();

        // History of all actions including the current state
        // let undoListRef = drawingItem.caretaker.undoList;
        // let undoList = Array.from(undoListRef);
        // let actionName = 'replay';
        // let currentState = drawingItem.originator.saveStateToMemento(actionName);
        // undoList.push(currentState);

        let index = 0; // Start from the first item in the undo list
    
        // Show the replay area
        var el_outer = document.getElementById('replay-area-outer');
        el_outer.classList.remove('hidden');
        resizeCanvas();
    
        var el_canvas = document.getElementById('replay-canvas');
        var ctx = el_canvas.getContext('2d');

        var el_message = document.getElementById('replay-message');
    
        // The undoList contains the history items
        const replayStep = () => {
            if (index >= history_items.length) {
                console.log('Replay finished');
                return; // Stop the replay if we've reached the end of the undo list
            }
            let item = history_items[index]; // Get the current item to be drawn
            index++; // Move to the next item for the next iteration

            let message = item.message;
            el_message.textContent = `Step ${index} of ${history_items.length}` + message;

            // Clear the canvas for the next drawing state
            ctx.clearRect(0, 0, el_canvas.width, el_canvas.height);

            let image = item.image;
            let inset = 5;
            let width = el_canvas.width - inset * 2;
            let height = el_canvas.height - inset * 2;    
            let cellSize = image.cellSize(width, height);
            let gapSize = this.isGridVisible ? 1 : 0;
    
            // Draw an outline around the image
            {
                let x = image.calcX0(0, width, cellSize) + inset - 1;
                let y = image.calcY0(0, height, cellSize) + inset - 1;
                let w = image.width * cellSize + 2 - gapSize;
                let h = image.height * cellSize + 2 - gapSize;
                ctx.fillStyle = '#555';
                ctx.fillRect(x, y, w, h);
            }
            let options = {
                gapSize: gapSize,
            };
            image.draw(this.theme, ctx, inset, inset, width, height, cellSize, options);

            // Schedule the next step
            setTimeout(replayStep, 100);
        };
    
        replayStep(); // Start the replay loop
    }

    dismissReplayLayer() {
        var el = document.getElementById('replay-area-outer');
        el.classList.add('hidden');
        resizeCanvas();
        this.updateDrawCanvas();
    }

    downloadReplayFile() {
        let user = 'anonymous';

        // Date/time formatting
        // utcTimestampWithSubsecond: "1984-12-24T23:59:59.987Z"
        let utcTimestampWithSubsecond = new Date().toISOString();
        // utcTimestampWithoutSubsecond: "1984-12-24T23:59:59Z"
        let utcTimestampWithoutSubsecond = utcTimestampWithSubsecond.split('.')[0] + 'Z';
        // utcTimestampWithoutColon: "1984-12-24T23-59-59Z"
        let utcTimestampWithoutColon = utcTimestampWithoutSubsecond.replace(/:/g, '-');

        let historyJSON = this.history.toJSON();

        let summary = {
            "history count": this.history.items.length,
        };

        var dict = {
            "timestamp": utcTimestampWithoutSubsecond,
            "user": user,
            "dataset": this.datasetId, 
            "task": this.taskId,
            "summary": summary,
            "history": historyJSON
        };
        let jsonString = JSON.stringify(dict);

        let filename = `ARC-Interactive history ${utcTimestampWithoutColon}.json`;

        // Convert the JSON string to a Blob
        var blob = new Blob([jsonString], { type: 'application/json' });

        // Create a URL for the Blob
        var url = URL.createObjectURL(blob);

        // Create a temporary anchor element
        var a = document.createElement('a');
        a.href = url;
        a.download = filename; // The default filename for the downloaded file

        // Append the anchor to the document
        document.body.appendChild(a);

        // Programmatically click the anchor to trigger the download
        a.click();

        // Clean up by removing the anchor element and revoking the Blob URL
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    clickUploadReplayFile() {
        document.getElementById('file-input').click(); // Programmatically click the hidden file input
    }

    changeInputFile(event) {
        var file = event.target.files[0];
        if (!file) {
            return;
        }

        var reader = new FileReader();
        reader.onload = (e) => {
            var jsonString = e.target.result;
            this.replayHistoryFile(jsonString);
        };
        
        reader.onerror = (e) => {
            console.error("Error reading file", e);
        };

        reader.readAsText(file); // Read the file as text
    }

    replayHistoryFile(jsonString) {
        // console.log('json:', jsonString);
        let obj = JSON.parse(jsonString);
        // console.log('obj:', obj);
        let history_items = obj.history;
        let history_items2 = []; 
        for (let i = 0; i < history_items.length; i++) {
            let item = history_items[i];
            console.log('item:', item);

            var arc_image = null;
            if (item.dict && item.dict.image) {
                arc_image = new ARCImage(item.dict.image);
            }
            if (!arc_image) {
                arc_image = ARCImage.color(5, 5, 0);
            }

            var message = item.message;

            let history_item2 = {
                message: message,
                image: arc_image,
            };
            history_items2.push(history_item2);
        }
        const callback = () => {
            this.replay2(history_items2);
        };
        setTimeout(callback, 100);
    }
}

var gPageController = null;
  
function body_onload() {
    // Resize the canvas to match the parent div size on initial load
    resizeCanvas();
    gPageController = new PageController();
    (async () => {
        gPageController.onload();
    })();
}

function resizeCanvas() {
    {
        let canvas = document.getElementById('draw-canvas');
        let parentDiv = document.getElementById('draw-area-outer');    
        canvas.width = parentDiv.clientWidth;
        canvas.height = parentDiv.clientHeight;
    }
    {
        let canvas = document.getElementById('paste-canvas');
        let parentDiv = document.getElementById('paste-area-outer');
        canvas.width = parentDiv.clientWidth;
        canvas.height = parentDiv.clientHeight;
    }
    {
        let canvas = document.getElementById('replay-canvas');
        let parentDiv = document.getElementById('replay-area-outer');
        canvas.width = parentDiv.clientWidth;
        canvas.height = parentDiv.clientHeight;
    }
}
