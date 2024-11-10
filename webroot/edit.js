function goBack() {
    history.back(); // Go back to the previous page
    return false;  // Prevents the default anchor action
}

class Memento {
    constructor(state, message) {
        this.state = state;
        this.message = message;
    }

    getState() {
        return this.state;
    }

    getMessage() {
        return this.message;
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

    saveStateToMemento(message) {
        let savedState = {
            image: this.state.image.clone(),
        };
        return new Memento(savedState, message);
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

    saveState(originator, message) {
        this.redoList = []; // Clear the redoList because new action invalidates the redo history
        this.undoList.push(originator.saveStateToMemento(message));
    }

    clearHistory() {
        this.undoList = [];
        this.redoList = [];
    }

    printHistory() {
        console.log("Action History:");
        this.undoList.forEach((memento, index) => {
            console.log(`${index + 1}: ${memento.getMessage()}`);
        });
    }

    canUndo() {
        return this.undoList.length > 0;
    }

    canRedo() {
        return this.redoList.length > 0;
    }

    undo(originator) {
        if (!this.canUndo()) {
            throw new Error("No actions to undo. undoList is empty");
        }
        let memento = this.undoList.pop();
        let message = memento.getMessage();
        this.redoList.push(originator.saveStateToMemento(message)); // save current state before undoing
        originator.getStateFromMemento(memento);
        return message;
    }

    redo(originator) {
        if (!this.canRedo()) {
            throw new Error("No actions to redo. redoList is empty");
        }
        let memento = this.redoList.pop();
        let message = memento.getMessage();
        this.undoList.push(originator.saveStateToMemento(message)); // save current state before redoing
        originator.getStateFromMemento(memento);
        return message;
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
        this.submitCorrectCount = 0;
        this.submitIncorrectCount = 0;
        this.startOverCount = 0;
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

    // When serializing the history to json, this function is called 
    // to get a string that describes what image is being manipulated.
    // Currently the user can only edit the `output` image of the `test` pairs.
    // In the future the user may be able to edit both input images, output images.
    // In the future the user may be able to edit both train pairs and test pairs.
    getHistoryImageHandle() {
        return `test ${this.id} output`;
    }
}

class HistoryItem {
    constructor(id, wait) {
        // The `id` is a non-negative integer that gets incremented for each new history item.
        this.id = id;

        // The `wait` is the number of milliseconds since previous history item. It's a non-negative integer.
        this.wait = wait;
    }
}

class HistoryContainer {
    constructor() {
        this.items = [];
        this.lastEventTime = null; // Tracks the time of the last event.
        this.startTime = new Date(); // Tracks the time when the history was created.
    }

    log(message, context = null) {
        const now = new Date();
        let msSinceLastEvent = 0;

        // Calculate the time difference if there is a last event time recorded
        if (this.lastEventTime !== null) {
            msSinceLastEvent = now.getTime() - this.lastEventTime.getTime();
        }

        // Update the last event time to now
        this.lastEventTime = now;

        // Create a new HistoryItem with the ID as the current length of items and the calculated msSinceLastEvent
        let item = new HistoryItem(this.items.length, msSinceLastEvent);
        item.message = message;
        if (context) {
            item.context = context;
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

class DrawInteractionState {
    constructor(key) {
        this.key = key;
        this.registerCount = 0;
    }

    register() {
        this.registerCount++;
    }
}

class PageController {
    constructor() {
        if (crypto.randomUUID) {
            console.log('crypto.randomUUID() is available.');
            this.updateUuid = crypto.randomUUID();
        } else {
            // Safari oddity:
            // In Safari on iPhone, crypto.randomUUID() is not available, when using http://
            // In Safari on iPhone, crypto.randomUUID() is available, when using https://
            console.log('crypto.randomUUID() is NOT available.');
            this.updateUuid = 'no-crypto-random-uuid';
        }

        this.history = new HistoryContainer();
        this.drawInteractionState = null;
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

        this.drawCanvas = document.getElementById('draw-canvas');
        this.pasteCanvas = document.getElementById('paste-canvas');
        this.isDrawing = false;
        this.currentColor = 0;
        this.currentTest = 0;
        this.currentTool = 'draw';
        this.numberOfTests = 1;
        this.drawingItems = [];
        this.inset = 2;
        this.clipboard = null;
        this.isPasteMode = false;
        this.isPasting = false;
        this.pasteCenterX = 0;
        this.pasteCenterY = 0;

        this.enablePlotDraw = false;

        this.statsRevealCount = 0;
        this.statsShowOverviewCount = 0;

        let maxPixelSize = 100;
        this.maxPixelSize = maxPixelSize;
        this.image = ARCImage.color(maxPixelSize, maxPixelSize, 0);

        this.isGridVisible = true;

        this.overviewRevealSolutions = false;

        this.overviewPageIndex = 0;

        this.isReplayUndoListButtonVisible = true;

        this.blockForStartDrawUntil = Date.now();

        {
            // Select the radio button with the id 'tool_draw'
            // Sometimes the browser remembers the last selected radio button, across sessions.
            // This code makes sure that the 'tool_draw' radio button is always selected on launch.
            document.getElementById('tool_draw').checked = true;
        }
    }

    async onload() {
        Theme.assignBodyClassName();
        this.theme = Theme.themeFromBody();
        
        this.db = await DatabaseWrapper.create();
        console.log('PageController.onload()', this.db);
        await this.loadTask();
        this.history.log('welcome to overview');
        this.addEventListeners();
        this.hideEditorShowOverview({ shouldHistoryLog: false });
        // await this.replayExampleHistoryFile();

        if (this.isReplayUndoListButtonVisible) {
            var el = document.getElementById('replay-undolist-button');
            el.classList.remove('hidden');
        }
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
        this.drawCanvas.addEventListener('touchstart', (event) => { this.startDraw(event); });
        this.drawCanvas.addEventListener('touchmove', (event) => { this.moveDraw(event); });
        this.drawCanvas.addEventListener('touchend', (event) => { this.stopDraw(event); });
        this.drawCanvas.addEventListener('mousedown', (event) => { this.startDraw(event); });
        this.drawCanvas.addEventListener('mousemove', (event) => { this.moveDraw(event); });
        this.drawCanvas.addEventListener('mouseup', (event) => { this.stopDraw(event); });
        this.drawCanvas.addEventListener('mouseout', (event) => { this.stopDraw(event); });

        // Interaction with the paste canvas
        this.pasteCanvas.addEventListener('touchstart', (event) => { this.startPaste(event); });
        this.pasteCanvas.addEventListener('touchmove', (event) => { this.movePaste(event); });
        this.pasteCanvas.addEventListener('touchend', (event) => { this.stopPaste(event); });
        this.pasteCanvas.addEventListener('mousedown', (event) => { this.startPaste(event); });
        this.pasteCanvas.addEventListener('mousemove', (event) => { this.movePaste(event); });
        this.pasteCanvas.addEventListener('mouseup', (event) => { this.stopPaste(event); });
        this.pasteCanvas.addEventListener('mouseout', (event) => { this.stopPaste(event); });

        // Listen for the keyup event
        window.addEventListener('keyup', (event) => { this.keyUp(event); });
        
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
            if (event.code === 'KeyD') {
                this.keyboardShortcutPickTool('tool_draw');
            }
            if (event.code === 'KeyS') {
                this.keyboardShortcutPickTool('tool_select');
            }
            if (event.code === 'KeyF') {
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
            if (event.code === 'KeyX') {
                this.flipX();
            }
            if (event.code === 'KeyY') {
                this.flipY();
            }
            if (event.code === 'KeyT') {
                this.showToolPanel();
            }
            if (event.code === 'Digit0') {
                this.pickColor(0);
            }
            if (event.code === 'Digit1') {
                this.pickColor(1);
            }
            if (event.code === 'Digit2') {
                this.pickColor(2);
            }
            if (event.code === 'Digit3') {
                this.pickColor(3);
            }
            if (event.code === 'Digit4') {
                this.pickColor(4);
            }
            if (event.code === 'Digit5') {
                this.pickColor(5);
            }
            if (event.code === 'Digit6') {
                this.pickColor(6);
            }
            if (event.code === 'Digit7') {
                this.pickColor(7);
            }
            if (event.code === 'Digit8') {
                this.pickColor(8);
            }
            if (event.code === 'Digit9') {
                this.pickColor(9);
            }
            if (this.isReplayUndoListButtonVisible) {
                if (event.code === 'KeyP') {
                    this.replayUndoList();
                }
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

        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let { minX, maxX, minY, maxY } = drawingItem.getSelectedRectangleCoordinates();

        let message = `change tool to ${toolId}`;
        var context = {
            action: 'pick tool',
            toolId: toolId,
            imageHandle: historyImageHandle,
        };
        if (toolId === 'select') {
            let selectWidth = maxX - minX + 1;
            let selectHeight = maxY - minY + 1;
            context.selectX = minX;
            context.selectY = minY;
            context.selectWidth = selectWidth;
            context.selectHeight = selectHeight;
        }
        this.history.log(message, context);
    }

    undoAction() {
        // console.log('Undo action');
        let drawingItem = this.currentDrawingItem();

        if (!drawingItem.caretaker.canUndo()) {
            console.log('No actions to undo.');
            return;
        }

        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let undoMessage = drawingItem.caretaker.undo(drawingItem.originator);
        let image = drawingItem.originator.getImageClone();
        this.updateDrawCanvas();
        this.hideToolPanel();

        console.log(`Undid action: ${undoMessage}`);
        let message = `undo action: ${undoMessage}`;
        this.history.log(message, {
            action: 'undo',
            undoMessage: undoMessage,
            imageHandle: historyImageHandle,
            sameImage: false,
            image: image.pixels,
        });
    }

    redoAction() {
        // console.log('Redo action');
        let drawingItem = this.currentDrawingItem();

        if (!drawingItem.caretaker.canRedo()) {
            console.log('No actions to redo.');
            return;
        }

        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let redoMessage = drawingItem.caretaker.redo(drawingItem.originator);
        let image = drawingItem.originator.getImageClone();
        this.updateDrawCanvas();
        this.hideToolPanel();

        console.log(`Redid action: ${redoMessage}`);
        let message = `redo action: ${redoMessage}`;
        this.history.log(message, {
            action: 'redo',
            redoMessage: redoMessage,
            imageHandle: historyImageHandle,
            sameImage: false,
            image: image.pixels,
        });
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

        this.pasteCenterX = position.x;
        this.pasteCenterY = position.y;
        // console.log('Paste mode. x:', this.pasteCenterX, 'y:', this.pasteCenterY);
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

        this.pasteCenterX = position.x;
        this.pasteCenterY = position.y;
        // console.log('Paste mode. x:', this.pasteCenterX, 'y:', this.pasteCenterY);
        this.updateDrawCanvas();
    }

    stopPaste(event) {
        event.preventDefault();
        this.isPasting = false;
    }

    startDraw(event) {
        event.preventDefault();
        const now = Date.now();
        if (now < this.blockForStartDrawUntil) {
            return;
        }
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
            this.pasteCenterX = position.x;
            this.pasteCenterY = position.y;
            // console.log('Paste mode. x:', this.pasteCenterX, 'y:', this.pasteCenterY);
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
            this.createSelectionBegin(cellx, celly);
            return;
        }

        if (cellx < 0 || cellx >= originalImage.width) {
            return;
        }
        if (celly < 0 || celly >= originalImage.height) {
            return;
        }
        if(this.currentTool == 'draw') {
            this.drawPixel(cellx, celly, this.currentColor);
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
            this.pasteCenterX = position.x;
            this.pasteCenterY = position.y;
            // console.log('Paste mode. x:', this.pasteCenterX, 'y:', this.pasteCenterY);
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
            this.createSelectionUpdate(cellx, celly);
            return;
        }

        if (cellx < 0 || cellx >= originalImage.width) {
            return;
        }
        if (celly < 0 || celly >= originalImage.height) {
            return;
        }
        if(this.currentTool == 'draw') {
            this.drawPixel(cellx, celly, this.currentColor);
        }
    }

    stopDraw(event) {
        event.preventDefault();
        this.isDrawing = false;

        if(this.currentTool == 'draw') {
            this.finishDrawInteractionState();
        }
    }

    createSelectionBegin(unclampedX, unclampedY) {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageRef();
        let x = Math.max(0, Math.min(unclampedX, originalImage.width - 1));
        let y = Math.max(0, Math.min(unclampedY, originalImage.height - 1));
        
        let sameX0 = drawingItem.selectRectangle.x0 == x;
        let sameY0 = drawingItem.selectRectangle.y0 == y;
        let sameX1 = drawingItem.selectRectangle.x1 == x;
        let sameY1 = drawingItem.selectRectangle.y1 == y;
        let sameSelection = sameX0 && sameY0 && sameX1 && sameY1;

        drawingItem.selectRectangle.x0 = x;
        drawingItem.selectRectangle.y0 = y;
        drawingItem.selectRectangle.x1 = x;
        drawingItem.selectRectangle.y1 = y;
        this.updateDrawCanvas();

        let message = `create selection begin, x: ${x} y: ${y}`;
        this.history.log(message, {
            action: 'create selection begin',
            imageHandle: historyImageHandle,
            sameSelection: sameSelection,
            x: x,
            y: y,
            selectX: x,
            selectY: y,
            selectWidth: 1,
            selectHeight: 1,
        });
    }

    createSelectionUpdate(unclampedX, unclampedY) {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageRef();

        let x = Math.max(0, Math.min(unclampedX, originalImage.width - 1));
        let y = Math.max(0, Math.min(unclampedY, originalImage.height - 1));
        let sameSelection = drawingItem.selectRectangle.x1 === x && drawingItem.selectRectangle.y1 === y;
        if (sameSelection) {
            // console.log('The selection is the same after createSelectionUpdate.');
            return;
        }
        drawingItem.selectRectangle.x1 = x;
        drawingItem.selectRectangle.y1 = y;
        this.updateDrawCanvas();

        let { minX, maxX, minY, maxY } = drawingItem.getSelectedRectangleCoordinates();
        let selectWidth = maxX - minX + 1;
        let selectHeight = maxY - minY + 1;

        let message = `create selection update, x: ${x} y: ${y}`;
        this.history.log(message, {
            action: 'create selection update',
            imageHandle: historyImageHandle,
            sameSelection: sameSelection,
            x: x,
            y: y,
            selectX: minX,
            selectY: minY,
            selectWidth: selectWidth,
            selectHeight: selectHeight,
        });
    }

    finishDrawInteractionState() {
        if (!this.drawInteractionState) {
            return;
        }
        // console.log(`key ${this.drawInteractionState.key} registerCount: ${this.drawInteractionState.registerCount}`);
        this.drawInteractionState = null;
    }

    prepareDrawInteractionState(x, y, color) {
        let key = `x${x}y${y}c${color}`;
        if (!this.drawInteractionState) {
            this.drawInteractionState = new DrawInteractionState(key);
            return;
        }
        if(this.drawInteractionState.key != key) {
            this.finishDrawInteractionState();
            this.drawInteractionState = new DrawInteractionState(key);
            return;
        }
    }

    drawPixel(x, y, color) {
        this.prepareDrawInteractionState(x, y, color);
        this.drawInteractionState.register();
        if (this.drawInteractionState.registerCount > 1) {
            // The gesture recognizer fires many times per second. 60 times per second I guess.
            // When interacting with a single pixel, it may fire several times.
            // This code prevents flooding the history with duplicate entries.
            // console.log('drawPixel is called more than once for the same pixel');
            return;
        }

        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        var image = originalImage.clone();
        try {
            image.setPixel(x, y, color);
        } catch (error) {
            console.error('Error setting pixel', error);
            return;
        }
        let sameImage = image.isEqualTo(originalImage);

        let message = `draw, x: ${x} y: ${y} color: ${color}`;
        this.history.log(message, {
            action: 'draw',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: x,
            y: y,
            color: color,
            image: image.pixels,
        });

        if (sameImage) {
            // console.log('The image is the same after setPixel.');
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
    }

    floodFill(x, y, color) {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        var image = originalImage.clone();
        image.floodFill(x, y, color);
        let sameImage = image.isEqualTo(originalImage);

        let message = `flood fill, x: ${x} y: ${y} color: ${color}`;
        this.history.log(message, {
            action: 'flood fill',
            sameImage: sameImage,
            imageHandle: historyImageHandle,
            x: x,
            y: y,
            color: color,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after floodFill.');
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
    }

    pickColor(colorValue) {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();

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

        let message = `pick color ${colorValue}`;
        this.history.log(message, {
            action: 'pick color',
            sameColor: isSameColor,
            imageHandle: historyImageHandle,
            color: colorValue,
        });
    }

    fillSelectedRectangle() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
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
        let selectX = minX;
        let selectY = minY;
        let selectWidth = maxX - minX + 1;
        let selectHeight = maxY - minY + 1;
        let color = this.currentColor;
        var image = originalImage.clone();
        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                image.pixels[y][x] = color;
            }
        }
        let sameImage = image.isEqualTo(originalImage);

        let message = `fill selection, x: ${selectX} y: ${selectY} width: ${selectWidth} height: ${selectHeight} color: ${color}`;
        this.history.log(message, {
            action: 'fill selection',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: selectX,
            y: selectY,
            width: selectWidth,
            height: selectHeight,
            color: color,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after filling the selection.');
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
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

    // Measure the size of the puzzle, for determining if the entire puzzle can fit inside the overview area.
    // If the puzzle is too large, then the "train" pairs will have to be paginated, which is undesired.
    // If the user press the "Reveal" button, then the output images are shown.
    // If the user hasn't begun drawing, then no output image is shown.
    // If the user has begun drawing, then the current output image is shown.
    sizeOfOverviewContent() {
        let task = this.task;
        // Size of "train" pairs
        var trainSumWidth = 0;
        var trainMaxInputHeight = 0;
        var trainMaxOutputHeight = 0;
        for (let i = 0; i < task.train.length; i++) {
            let input = task.train[i].input;
            let output = task.train[i].output;
            trainSumWidth += Math.max(input.width, output.width);
            trainMaxInputHeight = Math.max(trainMaxInputHeight, input.height);
            trainMaxOutputHeight = Math.max(trainMaxOutputHeight, output.height);
        }
        // Size of "test" pairs
        var testSumWidth = 0;
        var testMaxInputHeight = 0;
        var testMaxOutputHeight = 0;
        for (let i = 0; i < task.test.length; i++) {
            let input = task.test[i].input;
            let output = this.outputImageForTestIndexBasedOnUIMode(i);
            var outputWidth = 0;
            var outputHeight = 0;
            if (output) {
                outputWidth = output.width;
                outputHeight = output.height;
            }
            testSumWidth += Math.max(input.width, outputWidth);
            testMaxInputHeight = Math.max(testMaxInputHeight, input.height);
            testMaxOutputHeight = Math.max(testMaxOutputHeight, outputHeight);
        }
        // Total size
        let width = trainSumWidth + testSumWidth;
        let inputMaxHeight = Math.max(trainMaxInputHeight, testMaxInputHeight);
        let outputMaxHeight = Math.max(trainMaxOutputHeight, testMaxOutputHeight);
        let height = inputMaxHeight + outputMaxHeight;
        return {
            'width': width,
            'inputMaxHeight': inputMaxHeight,
            'outputMaxHeight': outputMaxHeight,
            'height': height,
        };
    }

    calcCellSizeForOverview(task, dpr, revealSolutions, maxTrain) {
        let n_train = Math.min(task.train.length, maxTrain);
        let el = document.getElementById('main-inner');
        let width = el.clientWidth;
        let height = el.clientHeight;
        // console.log('calcCellSizeForOverview() width:', width, 'height:', height);

        let heightOfNonImage = 75;
        let separatorWidth = 10;
        let paddingWidth = (n_train + task.test.length) * 20;
        let widthOfNonImage = separatorWidth + paddingWidth;

        let separatorSize = 1;
        var sumPixelWidth = 0;
        for (let i = 0; i < n_train; i++) {
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
            if (revealSolutions) {
                output = task.test[i].output;
            }
            sumPixelWidth += Math.max(input.width, output.width);
        }
        sumPixelWidth += separatorSize * (n_train + task.test.length - 1);

        var maxPixelHeight = 0;
        for (let i = 0; i < n_train; i++) {
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
            if (revealSolutions) {
                output = task.test[i].output;
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

    // The user is pressing down the button that reveals the solutions. By default the solutions are hidden.
    overviewRevealSolutionsYes() {
        this.overviewRevealSolutions = true;
        this.updateOverview();

        this.statsRevealCount++;

        let message = 'reveal begin';
        this.history.log(message);
    }

    // The user is releasing the button that reveals the solutions. So the solutions are hidden again.
    overviewRevealSolutionsNo() {
        this.overviewRevealSolutions = false;
        this.updateOverview();

        let message = 'reveal end';
        this.history.log(message);
    }

    // Rebuild the overview table, so it shows what the user has drawn so far.
    updateOverview() {
        let task = this.task;

        // Get the device pixel ratio, falling back to 1.
        let devicePixelRatio = window.devicePixelRatio || 1;
        // let devicePixelRatio = 1;
        // console.log('devicePixelRatio:', devicePixelRatio);

        let sizeOfOverviewContent = this.sizeOfOverviewContent();
        console.log('sizeOfOverviewContent:', sizeOfOverviewContent);

        // Size of the overview <div>
        let el_overview = document.getElementById('task-overview');
        let width_raw = el_overview.clientWidth;
        let height_raw = el_overview.clientHeight;
        let width = width_raw * devicePixelRatio;
        let height = height_raw * devicePixelRatio;
        console.log('updateOverview() width:', width, 'height:', height, 'width_raw:', width_raw, 'height_raw:', height_raw, 'devicePixelRatio:', devicePixelRatio);

        const image_padding = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ui-overview-image-padding'));
        console.log('image_padding:', image_padding);

        let idealCellSize = 1;
        {
            // Calculate ideal cell size.
            // Considering the best case scenario where the entire puzzle fits inside the overview area.
            // If it turns out that the ideal cell size is too small, then kludgy workaround such as pagination may be enabled.
            // This happens if the puzzle is too large, the ARC-Heavy has 30 pairs, where ARC-AGI has between 3 and 10 pairs.
            // This happens if the device has too tiny a screen, such as a mobile phone.
            let dpr = devicePixelRatio;
            let pairCount = task.train.length + task.test.length;
            let puzzleWidth = sizeOfOverviewContent.width;
            let puzzleHeight = sizeOfOverviewContent.height;
            let leftRightPaddingOfPuzzle = 6;
            let heightOfImageSizeLabels = 75;
            let widthOfNonImage = image_padding * (pairCount * 2 + 1) + leftRightPaddingOfPuzzle + pairCount;
            let heightOfNonImage = heightOfImageSizeLabels + image_padding * 2;
            let cellSizeX = Math.floor((width_raw - widthOfNonImage) * dpr / puzzleWidth);
            let cellSizeY = Math.floor((height_raw - heightOfNonImage) * dpr / puzzleHeight);
            let idealCellSizeRaw = Math.min(cellSizeX, cellSizeY);
            idealCellSize = idealCellSizeRaw / devicePixelRatio;
            console.log('idealCellSizeRaw:', idealCellSizeRaw, 'idealCellSize:', idealCellSize);
        }

        var pageCapacity = task.train.length;
        var pageCount = 1;
        var lastPageIndex = 1;
        var train_offset = 0;
        var n_train = task.train.length;
        var paginatedCellSize = 1;
        if (idealCellSize < 3) {
            console.log('The ideal cell size is too small. Pagination may be enabled.');

            let maxExampleCount = Math.max(6 - task.test.length, 3);
            console.log('maxExampleCount:', maxExampleCount);
    
            pageCapacity = Math.min(task.train.length, maxExampleCount);
            pageCount = Math.floor((task.train.length - 1) / pageCapacity) + 1;
            console.log('pageCount:', pageCount, 'pageCapacity:', pageCapacity, 'task.train.length:', task.train.length);
            lastPageIndex = pageCount - 1;
            // Clamp the overviewPageIndex to a valid range.
            if (this.overviewPageIndex < 0) {
                this.overviewPageIndex = lastPageIndex;
                // console.log('Negative overviewPageIndex. Go to last page. pageCapacity:', pageCapacity, 'task.train.length:', task.train.length, 'new page index:', this.overviewPageIndex);
            } else if (this.overviewPageIndex > lastPageIndex) {
                this.overviewPageIndex = 0;
                // console.log('Too large overviewPageIndex. Go to first page. pageCapacity:', pageCapacity, 'task.train.length:', task.train.length, 'new page index:', this.overviewPageIndex);
            }
    
            train_offset = this.overviewPageIndex * pageCapacity;
            n_train = Math.min(task.train.length - train_offset, pageCapacity);
            console.log('train_offset:', train_offset, 'n_train:', n_train, 'task.train.length:', task.train.length, 'pageCapacity:', pageCapacity, 'overviewPageIndex:', this.overviewPageIndex);
    
            let paginatedCellSizeRaw = this.calcCellSizeForOverview(task, devicePixelRatio, this.overviewRevealSolutions, n_train);
            paginatedCellSize = paginatedCellSizeRaw / devicePixelRatio;
            console.log('paginatedCellSizeRaw:', paginatedCellSizeRaw, 'paginatedCellSize:', paginatedCellSize);
        }
        let cellSize = Math.max(Math.max(idealCellSize, paginatedCellSize), 1);
        console.log('resolved cellSize:', cellSize);

        if (pageCount <= 1) {
            this.hidePagination();
        } else {
            this.showPagination();
        }

        // Show the current page index in the UI
        let el_pagination_status = document.getElementById('pagination-status');
        el_pagination_status.innerText = `${this.overviewPageIndex + 1} of ${lastPageIndex + 1}`;

        let el_tr0 = document.getElementById('task-overview-table-row0');
        let el_tr1 = document.getElementById('task-overview-table-row1');

        // Remove all children
        el_tr0.innerText = '';
        el_tr1.innerText = '';

        // Populate table for `train` pairs.
        for (let i = 0; i < n_train; i++) {
            let input = task.train[i + train_offset].input;
            let output = task.train[i + train_offset].output;
            let el_td0 = document.createElement('td');
            el_td0.classList.add('input-cell');
            let el_td1 = document.createElement('td');
            el_td1.classList.add('output-cell');
            // el_td0.innerText = `Input ${i + 1}`;
            // el_td1.innerText = `Output ${i + 1}`;

            {
                let el_div_parent = document.createElement('div');
                el_div_parent.className = 'input-vstack';

                {
                    let el_div = document.createElement('div');
                    el_div.className = 'image-size-label';
                    el_div.innerText = `${input.width}x${input.height}`;
                    el_div_parent.appendChild(el_div);
                }

                {
                    let canvas = input.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                    let el_div = document.createElement('div');
                    el_div.className = 'canvas-holder';
                    el_div.appendChild(canvas);
                    el_div_parent.appendChild(el_div);
                }
                el_td0.appendChild(el_div_parent);
            }

            {
                let el_div_parent = document.createElement('div');
                el_div_parent.className = 'output-vstack';

                {
                    let canvas = output.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                    let el_div = document.createElement('div');
                    el_div.className = 'canvas-holder';
                    el_div.appendChild(canvas);
                    el_div_parent.appendChild(el_div);
                }

                {
                    let el_div = document.createElement('div');
                    el_div.className = 'image-size-label';
                    el_div.innerText = `${output.width}x${output.height}`;
                    el_div_parent.appendChild(el_div);
                }
                el_td1.appendChild(el_div_parent);
            }
            el_tr0.appendChild(el_td0);
            el_tr1.appendChild(el_td1);
        }

        // Separate the `train` pairs and the `test` pairs.
        {
            let el_td0 = document.createElement('td');
            el_td0.innerHTML = '&nbsp;';
            el_td0.classList.add('seperator-column');
            el_td0.rowSpan = 2;
            el_tr0.appendChild(el_td0);
        }

        // Populate table for `test` pairs.
        for (let i = 0; i < task.test.length; i++) {
            let input = task.test[i].input;
            let output = task.test[i].output;
            let el_td0 = document.createElement('td');
            el_td0.classList.add('input-cell');
            let el_td1 = document.createElement('td');
            el_td1.classList.add('output-cell');
            // el_td0.innerText = `Input ${i + 1}`;
            // el_td1.innerText = `Output ${i + 1}`;

            if (i == this.currentTest) {
                el_td0.classList.add('active-test');
                el_td1.classList.add('active-test');
                let handler = () => {
                    this.brieflyBlockForStartDraw();
                    this.hideOverviewShowEditor();
                };
                el_td0.onpointerdown = handler;
                el_td1.onpointerdown = handler;
            } else {
                el_td0.classList.add('click-to-active-test');
                el_td1.classList.add('click-to-active-test');
                let handler = () => {
                    this.activateTestIndex(i);
                };
                el_td0.onpointerdown = handler;
                el_td1.onpointerdown = handler;
            }

            {
                let el_div_parent = document.createElement('div');
                el_div_parent.className = 'input-vstack';

                {
                    let el_div = document.createElement('div');
                    el_div.className = 'image-size-label';
                    el_div.innerText = `${input.width}x${input.height}`;
                    el_div_parent.appendChild(el_div);
                }

                {
                    let canvas = input.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                    let el_div = document.createElement('div');
                    el_div.className = 'canvas-holder';
                    el_div.appendChild(canvas);
                    el_div_parent.appendChild(el_div);
                }
                el_td0.appendChild(el_div_parent);
            }

            {
                let el_div_parent = document.createElement('div');
                el_div_parent.className = 'output-vstack';

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
                    el_div_parent.innerText = '?';
                } else {
                    {
                        let canvas = image.toCanvasWithStyle(this.theme, devicePixelRatio, cellSize, this.isGridVisible);
                        let el_div = document.createElement('div');
                        el_div.className = 'canvas-holder';
                        el_div.appendChild(canvas);
                        el_div_parent.appendChild(el_div);
                    }
    
                    {
                        let el_div = document.createElement('div');
                        el_div.className = 'image-size-label';
                        el_div.innerText = `${image.width}x${image.height}`;
                        el_div_parent.appendChild(el_div);
                    }
                }
                el_td1.appendChild(el_div_parent);    
            }
            el_tr0.appendChild(el_td0);
            el_tr1.appendChild(el_td1);
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

                let pasteCenterX = this.pasteCenterX;
                let pasteCenterY = this.pasteCenterY;
                let clipboardImage = this.clipboard;
                let halfWidth = Math.floor(clipboardImage.width * cellSize / 2);
                let halfHeight = Math.floor(clipboardImage.height * cellSize / 2);
                let minXRaw = pasteCenterX - halfWidth;
                let minYRaw = pasteCenterY - halfHeight;
                let position2 = this.translateCoordinatesToSecondCanvas(this.pasteCanvas, this.drawCanvas, minXRaw, minYRaw);
                let drawX = Math.floor(position2.x);
                let drawY = Math.floor(position2.y);
                ctx.globalAlpha = 0.75;
                clipboardImage.drawInner(this.theme, ctx2, drawX, drawY, cellSize, gapSize);
                ctx.globalAlpha = 1;

                let x0 = image.calcX0(0, width, cellSize) + inset;
                let y0 = image.calcY0(0, height, cellSize) + inset;

                var minX = Math.floor((pasteCenterX - halfWidth - x0) / cellSize + 0.5);
                var minY = Math.floor((pasteCenterY - halfHeight - y0) / cellSize + 0.5);
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

    // Workaround for Chrome on Android devices.
    // When dismissing the overview and showing the editor, the touchstart event is fired immediately.
    // This method blocks the startDraw() method for a short time.
    brieflyBlockForStartDraw() {
        // timestamp now in milliseconds plus 0.4 second
        let timestamp = Date.now() + 400;
        this.blockForStartDrawUntil = timestamp;
    }

    hideOverviewShowEditor() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let image = drawingItem.originator.getImageRef();

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

        let message = 'hide overview show editor';
        this.history.log(message, {
            action: 'hide overview show editor',
            imageHandle: historyImageHandle,
            image: image.pixels,
        });
    }

    hideEditorShowOverview(options = {}) {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();

        let el0 = document.getElementById("task-overview");
        let el1 = document.getElementById("page-footer-overview-mode");
        let el2 = document.getElementById("draw-area-outer");
        let el3 = document.getElementById("page-footer-draw-mode");
        el0.classList.remove('hidden');
        el1.classList.remove('hidden');
        el2.classList.add('hidden');
        el3.classList.add('hidden');

        this.updateOverview();

        this.statsShowOverviewCount++;
        // console.log('statsShowOverviewCount:', this.statsShowOverviewCount);

        var shouldHistoryLog = true;
        if (options.hasOwnProperty('shouldHistoryLog')) {
            shouldHistoryLog = options.shouldHistoryLog;
        }

        if (shouldHistoryLog) {
            let message = 'hide editor show overview';
            this.history.log(message, {
                action: 'hide editor show overview',
                imageHandle: historyImageHandle,
            });
        }
    }
    
    submitDrawing() {
        console.log('Submit');
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let image = drawingItem.originator.getImageRef();
        let json0 = JSON.stringify(image.pixels);

        let testIndex = this.currentTest % this.numberOfTests;
        let expectedImage = this.task.test[testIndex].output;
        let json1 = JSON.stringify(expectedImage.pixels);

        let isCorrect = json0 == json1;

        if (isCorrect) {
            drawingItem.submitCorrectCount++;
        } else {
            drawingItem.submitIncorrectCount++;
        }

        let message = isCorrect ? 'submit, correct' : 'submit, incorrect';
        this.history.log(message, {
            action: 'submit',
            imageHandle: historyImageHandle,
            correct: isCorrect,
            submitCorrectCount: drawingItem.submitCorrectCount,
            submitIncorrectCount: drawingItem.submitIncorrectCount,
            startOverCount: drawingItem.startOverCount,
            showOverviewCount: this.statsShowOverviewCount,
            image: image.pixels,
        });

        let { filename, jsonString } = this.generateHistoryFile();
        // POST the history file to the server
        this.postHistoryFile(filename, jsonString);

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

    postHistoryFile(filename, jsonString) {
        console.log(`Post history file to the server, updateUuid: ${this.updateUuid}`);
        const url = 'https://braingridgame.com/api/history_guest';
        // const url = 'http://localhost:8000/api/history_guest';
        fetch(
            url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filename: filename,
                jsonString: jsonString,
                updateUuid: this.updateUuid,
            })
        })
        .then(response => {
            if (response.ok) {
                console.log('History file was successfully posted to the server.');
                return response.text(); // This returns a promise
            } else {
                throw new Error('Error posting history file to the server.');
            }
        })
        .then(textResponse => {
            console.log(textResponse);
        })
        .catch(error => {
            console.error(error.message);
        });
    }
    
    imageForTestIndex(testIndex) {
        return this.drawingItems[testIndex].originator.getImageClone();
    }

    outputImageForTestIndexBasedOnUIMode(testIndex) {
        var image = null;
        if (this.drawingItems[testIndex].caretaker.undoList.length > 0) {
            // Only show an image when the user have drawn something.
            // If there are no actions to undo, then the user have not drawn anything.
            image = this.drawingItems[testIndex].originator.getImageRef();
        }
        if (this.overviewRevealSolutions) {
            // The user is holding down the button that reveals the solutions.
            image = this.task.test[testIndex].output;
        }
        return image;
    }

    activateTestIndex(testIndex) {
        let value0 = this.currentTest;
        this.currentTest = testIndex % this.numberOfTests;
        let value1 = this.currentTest;
        console.log(`Activate test: ${value0} -> ${value1}`);
        this.updateOverview();
        this.updateDrawCanvas();

        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let message = `activate test ${value1}`;
        this.history.log(message, {
            action: 'activate test',
            valueOld: value0,
            valueNew: value1,
            imageHandle: historyImageHandle,
        });
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
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let emptyImage = ARCImage.color(size.width, size.height, this.currentColor);
        let image = emptyImage.overlay(originalImage, 0, 0);
        let sameImage = image.isEqualTo(originalImage);

        let message = `resize, width: ${size.width} height: ${size.height} color: ${this.currentColor}`;
        this.history.log(message, {
            action: 'resize',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            width: size.width,
            height: size.height,
            color: this.currentColor,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after resize.');
            this.hideToolPanel();
            return;
        }

        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    startOverWithInputImage() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
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

        drawingItem.startOverCount++;

        let message = 'start over';
        this.history.log(message, {
            action: 'start over',
            imageHandle: historyImageHandle,
            sameImage: false,
            startOverCount: drawingItem.startOverCount,
            image: inputImage.pixels,
        });
    }

    cropSelectedRectangle() {
        if (!this.isCurrentToolSelect()) {
            console.log('Crop is only available in select mode.');
            return;
        }
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
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
        let cropX = minX;
        let cropY = minY;
        let cropWidth = maxX - minX + 1;
        let cropHeight = maxY - minY + 1;
        let image = originalImage.crop(cropX, cropY, cropWidth, cropHeight);
        let sameImage = image.isEqualTo(originalImage);

        let message = `crop, x: ${cropX} y: ${cropY} width: ${cropWidth} height: ${cropHeight}`;
        this.history.log(message, {
            action: 'crop',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: cropX,
            y: cropY,
            width: cropWidth,
            height: cropHeight,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after crop.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    copyToClipboard() {
        let rectangle = this.getToolRectangle();
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        var sameClipboard = false;
        if (this.clipboard) {
            sameClipboard = cropImage.isEqualTo(this.clipboard);
        }

        let message = `copy, x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'copy',
            imageHandle: historyImageHandle,
            sameClipboard: sameClipboard,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
        });

        if (sameClipboard) {
            console.log('Copied to clipboard. The clipboard already contains the same image.');
            this.hideToolPanel();
            return;
        }
        this.clipboard = cropImage;
        this.hideToolPanel();
        console.log(`Copied to clipboard. width: ${cropImage.width}, height: ${cropImage.height}`);
    }

    pasteFromClipboard() {
        if (!this.clipboard) {
            console.log('Paste from clipboard. Clipboard is empty');
            return;
        }
        let image = this.clipboard;
        console.log(`Paste from clipboard. width: ${image.width}, height: ${image.height}`);
        this.pasteCenterX = this.drawCanvas.width / 2;
        this.pasteCenterY = this.drawCanvas.height / 2;
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        this.hideToolPanel();
        this.isPasteMode = true;
        this.showPasteArea();
        resizeCanvas();
        this.updateDrawCanvas();

        let message = `paste begin, width: ${image.width} height: ${image.height}`;
        this.history.log(message, {
            action: 'paste begin',
            imageHandle: historyImageHandle,
            width: image.width,
            height: image.height,
        });
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
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();

        let cellSize = originalImage.cellSize(width, height);

        let pasteCenterX = this.pasteCenterX;
        let pasteCenterY = this.pasteCenterY;
        let clipboardImage = this.clipboard;
        let pasteWidth = clipboardImage.width;
        let pasteHeight = clipboardImage.height;
        let halfWidth = Math.floor(pasteWidth * cellSize / 2);
        let halfHeight = Math.floor(pasteHeight * cellSize / 2);

        let x0 = originalImage.calcX0(0, width, cellSize) + inset;
        let y0 = originalImage.calcY0(0, height, cellSize) + inset;

        let pasteMinX = Math.floor((pasteCenterX - halfWidth - x0) / cellSize + 0.5);
        let pasteMinY = Math.floor((pasteCenterY - halfHeight - y0) / cellSize + 0.5);

        let image = originalImage.overlay(clipboardImage, pasteMinX, pasteMinY);
        this.isPasteMode = false;

        let selectX0 = Math.max(0, Math.min(pasteMinX, image.width - 1));
        let selectY0 = Math.max(0, Math.min(pasteMinY, image.height - 1));
        let selectX1 = Math.max(0, Math.min(pasteMinX + pasteWidth - 1, image.width - 1));
        let selectY1 = Math.max(0, Math.min(pasteMinY + pasteHeight - 1, image.height - 1));
        let selectWidth = selectX1 - selectX0 + 1;
        let selectHeight = selectY1 - selectY0 + 1;

        let sameImage = image.isEqualTo(originalImage);

        let sameX0 = drawingItem.selectRectangle.x0 == selectX0;
        let sameY0 = drawingItem.selectRectangle.y0 == selectY0;
        let sameX1 = drawingItem.selectRectangle.x1 == selectX1;
        let sameY1 = drawingItem.selectRectangle.y1 == selectY1;
        let sameSelection = sameX0 && sameY0 && sameX1 && sameY1;

        let message = `paste accept, pasteX: ${pasteMinX} pasteY: ${pasteMinY} pasteWidth: ${pasteWidth} pasteHeight: ${pasteHeight}`;
        this.history.log(message, {
            action: 'paste accept',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            sameSelection: sameSelection,
            pasteX: pasteMinX,
            pasteY: pasteMinY,
            pasteWidth: pasteWidth,
            pasteHeight: pasteHeight,
            selectX: selectX0,
            selectY: selectY0,
            selectWidth: selectWidth,
            selectHeight: selectHeight,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after paste.');
            // It feels weird, not having any undo state after a paste.
            // Despite the paste not causing any difference.
            // I guess it's due to the Accept/Reject UI that feels like a major event, thus it should have an undo state.
        }

        drawingItem.selectRectangle.x0 = selectX0;
        drawingItem.selectRectangle.y0 = selectY0;
        drawingItem.selectRectangle.x1 = selectX1;
        drawingItem.selectRectangle.y1 = selectY1;

        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);

        this.updateDrawCanvas();
        this.hidePasteArea();
    }

    pasteFromClipboardReject() {
        console.log('Paste from clipboard reject.');
        this.isPasteMode = false;
        this.updateDrawCanvas();
        this.hidePasteArea();

        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();

        let message = `paste reject`;
        this.history.log(message, {
            action: 'paste reject',
            imageHandle: historyImageHandle
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
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let flippedImage = cropImage.flipX();
        let image = originalImage.overlay(flippedImage, rectangle.x, rectangle.y);
        let sameImage = image.isEqualTo(originalImage);

        let message = `flip x, x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'flip x',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after flip x.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Reverse the y-axis of the selected rectangle or the entire image
    flipY() {
        let rectangle = this.getToolRectangle();
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let flippedImage = cropImage.flipY();
        let image = originalImage.overlay(flippedImage, rectangle.x, rectangle.y);
        let sameImage = image.isEqualTo(originalImage);

        let message = `flip y, x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'flip y',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after flip y.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
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
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();

        let rectangle = this.getToolRectangle();
        if (rectangle.width != rectangle.height) {
            console.log('Rotate is only available for square selections.');
            let message = `rotate selection clockwise x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}, cannot rotate non-square selection`;
            this.history.log(message, {
                action: 'rotate selection clockwise',
                imageHandle: historyImageHandle,
                sameImage: true,
                x: rectangle.x,
                y: rectangle.y,
                width: rectangle.width,
                height: rectangle.height,
                image: originalImage.pixels,
            });
            return;
        }
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let rotatedImage = cropImage.rotateCW();
        let image = originalImage.overlay(rotatedImage, rectangle.x, rectangle.y);
        let sameImage = image.isEqualTo(originalImage);

        let message = `rotate selection clockwise, x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'rotate selection clockwise',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    rotateCW_entireImage() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let image = originalImage.rotateCW();
        let sameImage = image.isEqualTo(originalImage);

        let message = `rotate entire image clockwise`;
        this.history.log(message, {
            action: 'rotate entire image clockwise',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
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
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();

        let rectangle = this.getToolRectangle();
        if (rectangle.width != rectangle.height) {
            console.log('Rotate is only available for square selections.');
            let message = `rotate selection counter-clockwise x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}, cannot rotate non-square selection`;
            this.history.log(message, {
                action: 'rotate selection counter-clockwise',
                imageHandle: historyImageHandle,
                sameImage: true,
                x: rectangle.x,
                y: rectangle.y,
                width: rectangle.width,
                height: rectangle.height,
                image: originalImage.pixels,
            });
            return;
        }
        let cropImage = originalImage.crop(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let rotatedImage = cropImage.rotateCCW();
        let image = originalImage.overlay(rotatedImage, rectangle.x, rectangle.y);
        let sameImage = image.isEqualTo(originalImage);

        let message = `rotate selection counter-clockwise, x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'rotate selection counter-clockwise',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    rotateCCW_entireImage() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let image = originalImage.rotateCCW();
        let sameImage = image.isEqualTo(originalImage);

        let message = `rotate entire image counter-clockwise`;
        this.history.log(message, {
            action: 'rotate entire image counter-clockwise',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after rotate.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        drawingItem.assignSelectRectangleFromCurrentImage();
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move left with wrap around
    moveLeft() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let rectangle = this.getToolRectangle();
        let image = originalImage.moveLeft(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let sameImage = image.isEqualTo(originalImage);

        let message = `move left x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'move left',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move right with wrap around
    moveRight() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let rectangle = this.getToolRectangle();
        let image = originalImage.moveRight(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let sameImage = image.isEqualTo(originalImage);

        let message = `move right x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'move right',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move up with wrap around
    moveUp() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let rectangle = this.getToolRectangle();
        let image = originalImage.moveUp(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let sameImage = image.isEqualTo(originalImage);

        let message = `move up x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'move up',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    // Move down with wrap around
    moveDown() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageClone();
        let rectangle = this.getToolRectangle();
        let image = originalImage.moveDown(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
        let sameImage = image.isEqualTo(originalImage);

        let message = `move down x: ${rectangle.x} y: ${rectangle.y} width: ${rectangle.width} height: ${rectangle.height}`;
        this.history.log(message, {
            action: 'move down',
            imageHandle: historyImageHandle,
            sameImage: sameImage,
            x: rectangle.x,
            y: rectangle.y,
            width: rectangle.width,
            height: rectangle.height,
            image: image.pixels,
        });

        if (sameImage) {
            console.log('The image is the same after the move.');
            this.hideToolPanel();
            return;
        }
        drawingItem.caretaker.saveState(drawingItem.originator, message);
        drawingItem.originator.setImage(image);
        this.updateDrawCanvas();
        this.hideToolPanel();
    }

    isToolPanelHidden() {
        let el = document.getElementById("tool-panel");
        return el.classList.contains('hidden');
    }

    showToolPanel() {
        let drawingItem = this.currentDrawingItem();
        let historyImageHandle = drawingItem.getHistoryImageHandle();
        let originalImage = drawingItem.originator.getImageRef();

        {
            var el = document.getElementById('canvas-size-input');
            el.value = `${originalImage.width}x${originalImage.height}`;
        }
        if (!this.isToolPanelHidden()) {
            // Already visible. No need to show it again.
            return;
        }
        {
            var el = document.getElementById('tool-panel');
            el.classList.remove('hidden');
        }

        let message = 'show tool panel';
        this.history.log(message, {
            action: 'show tool panel',
            imageHandle: historyImageHandle
        });
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

    replayUndoList() {
        console.log('Replay start');
        this.hideToolPanel();

        let drawingItem = this.currentDrawingItem();
        // drawingItem.caretaker.printHistory();

        // History of all actions including the current state
        let undoListRef = drawingItem.caretaker.undoList;
        let undoList = Array.from(undoListRef);
        let actionName = 'the end';
        let currentState = drawingItem.originator.saveStateToMemento(actionName);
        undoList.push(currentState);

        let index = 0; // Start from the first item in the undo list
    
        // Show the replay area
        var el_outer = document.getElementById('replay-area-outer');
        el_outer.classList.remove('hidden');
        resizeCanvas();
    
        var el_canvas = document.getElementById('replay-canvas');
        var ctx = el_canvas.getContext('2d');
    
        var el_message_step = document.getElementById('replay-message-step');
        var el_message_text = document.getElementById('replay-message-text');

        // The undoList contains the history items
        const replayStep = () => {
            if (this.isReplayLayerHidden()) {
                console.log('Abort replay');
                return; // Stop the replay animation if the replay layer is hidden
            }
            if (index >= undoList.length) {
                console.log('Replay finished');
                return; // Stop the replay if we've reached the end of the animation
            }
            let mementoItem = undoList[index]; // Get the current item to be drawn
            index++; // Move to the next item for the next iteration
        
            el_message_step.textContent = `${index} of ${undoList.length}`;
            el_message_text.textContent = mementoItem.getMessage();

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

    replayHistoryItems(history_items) {
        console.log('Replay start');

        let index = 0; // Start from the first item in the undo list
    
        // Show the replay area
        var el_outer = document.getElementById('replay-area-outer');
        el_outer.classList.remove('hidden');
        resizeCanvas();
    
        var el_canvas = document.getElementById('replay-canvas');
        var ctx = el_canvas.getContext('2d');

        var el_message_step = document.getElementById('replay-message-step');
        var el_message_text = document.getElementById('replay-message-text');
    
        // The undoList contains the history items
        const replayStep = () => {
            if (this.isReplayLayerHidden()) {
                console.log('Abort replay');
                return; // Stop the replay animation if the replay layer is hidden
            }
            if (index >= history_items.length) {
                console.log('Replay finished');
                return; // Stop the replay if we've reached the end of the animation
            }
            let item = history_items[index]; // Get the current item to be drawn
            index++; // Move to the next item for the next iteration

            el_message_step.textContent = `${index} of ${history_items.length}`;
            el_message_text.textContent = item.message;

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

    isReplayLayerHidden() {
        let el = document.getElementById('replay-area-outer');
        return el.classList.contains('hidden');
    }

    dismissReplayLayer() {
        var el = document.getElementById('replay-area-outer');
        el.classList.add('hidden');
        resizeCanvas();
        this.updateDrawCanvas();
    }

    generateHistoryFile() {
        let user = 'anonymous';

        // Date/time formatting
        // utcTimestampWithSubsecond: "1984-12-24T23:59:59.987Z"
        let utcTimestampWithSubsecond = this.history.startTime.toISOString();
        // utcTimestampWithoutSubsecond: "1984-12-24T23:59:59Z"
        let utcTimestampWithoutSubsecond = utcTimestampWithSubsecond.split('.')[0] + 'Z';
        // utcTimestampWithoutColon: "1984-12-24T23-59-59Z"
        let utcTimestampWithoutColon = utcTimestampWithoutSubsecond.replace(/:/g, '-');

        let historyJSON = this.history.toJSON();

        // Count the number of test pairs that are solved/unsolved
        var testSolvedCount = 0;
        var testUnsolvedCount = 0;
        for (let i = 0; i < this.drawingItems.length; i++) {
            let drawingItem = this.drawingItems[i];
            if (drawingItem.submitCorrectCount > 0) {
                testSolvedCount++;
            } else {
                testUnsolvedCount++;
            }
        }

        // Number of times the user started over
        var sumStartOverCount = 0;
        for (let i = 0; i < this.drawingItems.length; i++) {
            let drawingItem = this.drawingItems[i];
            sumStartOverCount += drawingItem.startOverCount;
        }

        let summary = {
            "history count": this.history.items.length,
            "reveal count": this.statsRevealCount,
            "start over count": sumStartOverCount,
            "test solved count": testSolvedCount,
            "test unsolved count": testUnsolvedCount,
            "show overview count": this.statsShowOverviewCount,
        };

        var dict = {
            "fileType": "ARC-Interactive, history file, version 0.1.0",
            "startTime": utcTimestampWithoutSubsecond,
            "user": user,
            "dataset": this.datasetId, 
            "task": this.taskId,
            "summary": summary,
            "history": historyJSON
        };
        let jsonString = JSON.stringify(dict);

        let filename = `ARC-Interactive history ${utcTimestampWithoutColon}.json`;
        return { 
            filename,
            jsonString, 
        };
    }

    downloadHistoryFile() {
        let { filename, jsonString } = this.generateHistoryFile();

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
            if (item.context && item.context.image) {
                arc_image = new ARCImage(item.context.image);
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
            this.replayHistoryItems(history_items2);
        };
        setTimeout(callback, 100);
    }

    paginationGotoPreviousPage() {
        this.overviewPageIndex -= 1;
        this.updateOverview();
    }

    paginationGotoNextPage() {
        this.overviewPageIndex += 1;
        this.updateOverview();
    }

    hidePagination() {
        let el = document.getElementById("pagination");
        el.classList.remove('hidden');
        el.classList.add('hidden');
    }

    showPagination() {
        let el = document.getElementById("pagination");
        el.classList.remove('hidden');
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
