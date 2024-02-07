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
        this.updateCallbackUrl();

    
        this.setupSimpleAdvancedToggle();
    }

    // Simple / Advanced mode handling

    setupSimpleAdvancedToggle() {
        let advancedModeEnabled = localStorage.getItem('settings-advanced-mode-enabled');
        if ((advancedModeEnabled === "true") || (advancedModeEnabled === true)) {
            this.showAdvancedSettings();
        } else {
            this.hideAdvancedSettings();
        }

        document.getElementById('simple-advanced-toggle-button').addEventListener('click', () => {
            var el_advanced = document.getElementById('advanced-settings');
            var advanceModeEnabled = false;
            if (el_advanced.classList.contains('hidden')) {
                this.showAdvancedSettings();
                advanceModeEnabled = true;
            } else {
                this.hideAdvancedSettings();
                advanceModeEnabled = false;
            }
            localStorage.setItem('settings-advanced-mode-enabled', advanceModeEnabled);
        });
    }

    hideAdvancedSettings() {
        var el_advanced = document.getElementById('advanced-settings');
        el_advanced.classList.add('hidden');
        var button = document.getElementById('simple-advanced-toggle-button');
        button.textContent = "Switch to Advanced Mode";
    }

    showAdvancedSettings() {
        var el_advanced = document.getElementById('advanced-settings');
        el_advanced.classList.remove('hidden');
        var button = document.getElementById('simple-advanced-toggle-button');
        button.textContent = "Switch to Simple Mode";
    }

    // Theme handling

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

    // Callback URL handling

    callbackUrlOnKeyDown(event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            let url = document.getElementById('callback-url').value;
            localStorage.setItem('arc-interactive-callback-url', url);
            console.log("set callback-url:", url);
        }
    }

    updateCallbackUrl() {
        let url = localStorage.getItem('arc-interactive-callback-url');
        if (url) {
            document.getElementById('callback-url').value = url;
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
