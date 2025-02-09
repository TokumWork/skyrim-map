window.COORD_TYPES = {
    XY : 0,
    NORMALISED : 1,
    PSEUDO_NORMALISED : 1.5,
    WORLDSPACE : 2,
}

window.MAP_SETTINGS = {
    WIDTH : 65536,
    HEIGHT : 65536,
    MIN_X : -233600,
    MAX_X : 291000,
    MIN_Y : -316000,
    MAX_Y : 208900,
    MAX_RANGE_X : 524600,
    MAX_RANGE_Y : 524900,
}

/**
 * Convert XY/Normalised/Worldspace coordinates to leaflet's LatLongs.
 * @param {Object} coords - the coordinate/point object
 */
function toLatLngs(coords) {

    coords = structuredClone(coords) // make distinct

    if (coords?.x) {

        switch (coords.coordType) {
            default:
            case COORD_TYPES.XY:
                return [coords.x , coords.y];
            case COORD_TYPES.NORMALISED:
                let x = (Number(coords.x) * MAP_SETTINGS.WIDTH);
                let y = (Number(coords.y) * MAP_SETTINGS.HEIGHT);

                return map.unproject([x , y], getZoomLevel());
            case COORD_TYPES.PSEUDO_NORMALISED:
                coords.coordType = COORD_TYPES.NORMALISED;
                return this.toLatLngs(coords);
            case COORD_TYPES.WORLDSPACE:

                let xN = coords.x;
                let yN = coords.y;

                // get normalised value of x and y in range
                xN = (xN - MAP_SETTINGS.MIN_X) / MAP_SETTINGS.MAX_RANGE_X;
                yN = Math.abs((yN - MAP_SETTINGS.MAX_Y) / MAP_SETTINGS.MAX_RANGE_Y); // flip y around

                return this.toLatLngs({x: xN, y: yN, coordType: COORD_TYPES.NORMALISED});
        }

    }
}

function toCoords(latLngs) {
    latLngs = structuredClone(latLngs);

    let coords = map.project(latLngs, getZoomLevel());

    // get current map world pixel position values
    let nX = coords.x / MAP_SETTINGS.WIDTH;
    let nY = 1 - (coords.y / MAP_SETTINGS.HEIGHT);

    // reproject pixel values to worldspace
    let x = Math.trunc(MAP_SETTINGS.MIN_X + (MAP_SETTINGS.MAX_X - MAP_SETTINGS.MIN_X) * nX);
    let y = Math.trunc(MAP_SETTINGS.MIN_Y + (MAP_SETTINGS.MAX_Y - MAP_SETTINGS.MIN_Y) * nY);

    return {x: x , y: y , coordType : 2};
}

/**
 * calculate accurate zoom level for the given image size
 */
function getZoomLevel() {
    return Math.ceil(Math.log(Math.max(MAP_SETTINGS.WIDTH, MAP_SETTINGS.HEIGHT) / 256 ) / Math.log(2));
}

function showImportPopup() {
    document.getElementById(
        "jsonInputDialog"
    ).style.display = "block";
}

function closeImportPopup() {
    document.getElementById(
        "jsonInputDialog"
    ).style.display = "none";
}

function parseJSON() {
    var textInput = document.getElementById('jsonInputText').value;

    if (textInput !== '') {
        try {
            let json = JSON.parse(textInput);

            json.forEach((item) => {
                if (item.coords.x && item.coords.y) {
                    addMarker(item);
                }
            });
        } catch (e) {
            console.log(e)
        }
    }
}

function clickEvent(e) {
    if (e.originalEvent.ctrlKey) {
        addMarker({coords: toCoords(e.latlng)});
    }
}

function addMarker(data = {}) {
    let location = new Location(data);

    let locationIcon = L.icon({
        iconUrl: './assets/'+ location.iconId +'.png',
        iconAnchor: [12, 12],
        iconSize: [24, 24],
    });

    let marker = L.marker(toLatLngs({
        x: location.coords.x,
        y: location.coords.y,
        coordType: 2
    }), {icon: locationIcon, riseOnHover: true}).addTo(map);
    marker.setLocation(location);

    marker.bindTooltip(location.name, {
        className : "location-label",
        permanent: true,
        direction: "bottom",
        interactive: true,
        offset: [0, 2],
        riseOnHover: true,
    });

    marker.on('click', event => {
        let shift = event.originalEvent.shiftKey;
        onMarkerClicked(marker, shift);
    });
}

function onMarkerClicked(marker, shift) {
    if (shift) {
        L.popup(marker.getLatLng(), {content: marker.getEditContent()}).openOn(map);
    } else {
        L.popup(marker.getLatLng(), {content: marker.getLocation().getPopupContent()}).openOn(map);
    }
}

function copyToClipBoard(location) {
    let data = [{
        name: location?.name,
        iconId: location?.iconId,
        coords: {x: location?.coords?.x, y: location?.coords?.y}
    }]
    if (location?.description) {
        data[0]['description'] = location.description;
    }
    navigator.clipboard.writeText(JSON.stringify(data));
}

class Location {
    constructor(data) {
        this.name = data?.name ?? 'Custom location';
        this.description = data?.description || null;
        this.iconId = data?.iconId || 96;

        if (data?.coords?.x && data?.coords?.y) {
            this.coords = data.coords;
        } else {
            this.coords = {x: 0 , y: 0};
        }
    }

    getPopupContent() {
        let location = this;
        let popUpContainer = document.createElement("div");

        let popUpTitle = document.createElement("div");
        popUpTitle.className = 'popupTitle';
        popUpTitle.innerHTML = location.name;
        popUpContainer.appendChild(popUpTitle);

        let popupDesc = document.createElement("div");
        popupDesc.className = 'popupDesc';
        popupDesc.innerHTML = location.description ? location.description : '';
        popUpContainer.appendChild(popupDesc);

        let popupInfo = document.createElement("div");
        popupInfo.className = 'popupInfo';
        popupInfo.innerHTML = '<b>Coords:</b> ' + 'X: ' + location.coords.x + ', Y: ' + location.coords.y
        popUpContainer.appendChild(popupInfo);

        let line = document.createElement("hr");
        popUpContainer.appendChild(line);

        let button = document.createElement("button");
        button.innerHTML = 'Copy to clipboard';
        button.onclick = function()
        {
            copyToClipBoard(location);
        }
        popUpContainer.appendChild(button);

        return popUpContainer;
    }
}

/*================================================
				Leaflet Extensions
================================================*/

L.Layer.include({

    // properties
    location: null,

    // getters
    getLocation: function () {
        return this.location
    },
    generateFormContainer(type, name, label, value) {
        let popUpFormContainer = document.createElement("div");
        popUpFormContainer.className = 'form-group';

        let popUpFormLabel = document.createElement("label");
        popUpFormLabel.htmlFor = name;
        popUpFormLabel.innerHTML = label;
        popUpFormContainer.appendChild(popUpFormLabel);

        let popUpFormInput = document.createElement("input");
        popUpFormInput.type = type;
        if (type === 'number') {
            popUpFormInput.step = "1";
            popUpFormInput.min = "1";
        }
        popUpFormInput.id = name;
        popUpFormInput.name = name;
        popUpFormInput.className = 'form-control form-control-lg';
        popUpFormInput.value = value;
        popUpFormContainer.appendChild(popUpFormInput);

        return popUpFormContainer;
    },
    getEditContent() {
        let layer = this;
        let popUpContainer = document.createElement("div");
        popUpContainer.className = 'form-field';

        let popUpTitleContainer = this.generateFormContainer("text", "mname", "Title:", layer.location?.name)
        popUpContainer.appendChild(popUpTitleContainer);

        let popupIconContainer = this.generateFormContainer("number", "micon", "Icon ID:", layer.location?.iconId)
        popUpContainer.appendChild(popupIconContainer);

        let popupDescContainer = this.generateFormContainer("text", "mdesc", "Description:", layer.location?.description ? layer.location.description : '')
        popUpContainer.appendChild(popupDescContainer);

        let button = document.createElement("button");
        button.innerHTML = 'Save';
        button.onclick = function()
        {
            layer.location.name = document.getElementById('mname').value;
            layer.location.iconId = document.getElementById('micon').value;
            layer.location.description = document.getElementById('mdesc').value;

            layer.unbindTooltip();
            layer.bindTooltip(layer.location.name, {
                className : "location-label",
                permanent: true,
                direction: "bottom",
                interactive: true,
                offset: [0, 2],
                riseOnHover: true,
            });
        }
        popUpContainer.appendChild(button);

        return popUpContainer;
    },

    // setters
    setLocation(location) { this.location = location },
})