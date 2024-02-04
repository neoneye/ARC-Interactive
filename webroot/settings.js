class PageController {
    constructor() {
    }

    async onload() {
        // console.log("PageController.onload()");

        Theme.assignBodyClassName();

        var select = document.getElementById('select-theme');
        select.value = Theme.getTheme();

        // Callback when user make changes to the "select-theme" dropdown
        select.addEventListener('change', () => {
            this.onThemeChange();
        });

        this.updateColorPreview(false);
    }

    onThemeChange() {
        // console.log("PageController.onThemeChange()");
        let select = document.getElementById('select-theme');
        let theme = select.value;
        console.log("theme:", theme);

        Theme.setTheme(theme);
        Theme.assignBodyClassName();

        this.updateColorPreview(false);
    }

    shuffleColors() {
        this.updateColorPreview(true);
    }

    updateColorPreview(shuffle) {
        // console.log("PageController.shuffleColors()");
        var colors = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
        if (shuffle) {
            colors = colors.sort(() => Math.random() - 0.5);
        }
        
        // remove all children
        let el = document.getElementById('preview-theme-table');
        while (el.firstChild) {
            el.removeChild(el.firstChild);
        }

        // Create a <div> for each color
        for (var i = 0; i < colors.length; i++) {
            var color = colors[i];
            let el_cell = document.createElement('div');
            el_cell.className = `background-color-${color}`;
            el.appendChild(el_cell);
        }
    }
}

var gPageController = null;
  
function body_onload() {
    gPageController = new PageController();
    (async () => {
        gPageController.onload();
    })();
}
