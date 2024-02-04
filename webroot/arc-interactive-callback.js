class PageController {
    constructor() {
        // Create URLSearchParams object
        const urlParams = new URLSearchParams(window.location.search);

        // Get the 'task' parameter
        const urlParamTask = urlParams.get('task');

        {
            let el = document.getElementById('parameter-pair-list');
            for (const [key, value] of urlParams) {

                let el_key = document.createElement('div');
                el_key.className = "parameter-key";
                el_key.innerText = key;

                let el_value = document.createElement('div');
                el_value.className = "parameter-value";
                el_value.innerText = value;

                let el_pair = document.createElement('div');
                el_pair.className = "parameter-pair";
                el_pair.appendChild(el_key);
                el_pair.appendChild(el_value);
                el.appendChild(el_pair);
            }
        }

        {
            // Take all url params and insert into url. Should there be unknown params, they will be inserted as is.
            // let url = "http://localhost:8090/task?";
            let url = "http://localhost:8090/task/" + urlParamTask + "?";
            for (const [key, value] of urlParams) {
                url += key + "=" + value + "&";
            }

            let el = document.getElementById('redirect-link');
            el.href = url;
        }
    }

    async onload() {
        // console.log("PageController.onload()");

        Theme.assignBodyClassName();
    }
}

var gPageController = null;
  
function body_onload() {
    gPageController = new PageController();
    (async () => {
        gPageController.onload();
    })();
}
