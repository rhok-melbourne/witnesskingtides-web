var debugMessage = function(msg) {
	$("#debug").html(msg);
}

var FLICKR_USER_ID = '69841693@N07'; //witnesskingtides
var FLICKR_API_KEY = '3e35f603d86b21583ad77509dd9fd597';

/**
 * A specific format for parsing Flickr API JSON responses.
 */
OpenLayers.Format.Flickr = OpenLayers.Class(OpenLayers.Format, {
    read: function(obj) {
        if(obj.stat === 'fail') {
            throw new Error(
                ['Flickr failure response (',
                 obj.code,
                 '): ',
                 obj.message].join(''));
        }
        if(!obj || !obj.photos ||
           !OpenLayers.Util.isArray(obj.photos.photo)) {
            throw new Error(
                'Unexpected Flickr response');
        }
        var photos = obj.photos.photo, photo,
            x, y, point,
            feature, features = [];
        for(var i=0,l=photos.length; i<l; i++) {
            photo = photos[i];
            x = photo.longitude;
            y = photo.latitude;
            point = new OpenLayers.Geometry.Point(x, y);
            feature = new OpenLayers.Feature.Vector(point, {
                title: photo.title,
                img_url: photo.url_s
            });
            features.push(feature);
        }
        return features;
    }
});

var MapView = Backbone.View.extend({
	map: null,
	initialize: function(options) {

	},
	render: function() {
		this.map = new OpenLayers.Map("map");
		this.map.updateSize();
		//debugger;
		this.map.addLayer(new OpenLayers.Layer.OSM());
		this.createFlickrPhotoLayer();
		this.map.events.register("moveend", this, this.onMoveEnd);
		//this.map.zoomToMaxExtent();
		this.map.zoomToExtent(new OpenLayers.Bounds(10470115.700925, -5508791.4417243, 19060414.686531, -812500.42453675), false);
	},
	onMoveEnd: function(e) {
		logger.logi(this.map.getExtent());
	},
	createUserUploadedPhotoLayer: function() {

	},
	createFlickrPhotoLayer: function() {
		var style = new OpenLayers.Style({
            pointRadius: "${radius}",
            fillColor: "#ffcc66",
            fillOpacity: 0.8,
            strokeColor: "#cc6633",
            externalGraphic: "${thumbnail}",
            graphicWidth: 80,
            graphicHeight: 80,
            strokeWidth: 2,
            strokeOpacity: 0.8,
            label: "${label}"
        }, {
            context: {
                radius: function(feature) {
                    return Math.min(feature.attributes.count, 7) + 3;
                },
                label: function(feature) {
                	return (feature.cluster.length > 1) ? 
                		feature.cluster.length :
                		""
                },
                thumbnail: function(feature) {
                	if (feature.cluster.length <= 1) {
                		return feature.cluster[0].attributes.img_url;
                	}	
                	return "";
                }
            }
        });

		var layer = new OpenLayers.Layer.Vector("Photos", {
            projection: "EPSG:4326",
            strategies: [
                new OpenLayers.Strategy.Fixed(),
                new OpenLayers.Strategy.Cluster()
            ],
            protocol: new OpenLayers.Protocol.Script({
                url: "http://api.flickr.com/services/rest",
                params: {
                    api_key: FLICKR_API_KEY,
                    format: 'json',
                    user_id: FLICKR_USER_ID,
                    method: 'flickr.photos.search',
                    extras: 'geo,url_s',
                    per_page: 150,
                    page: 1,
                    bbox: [-180, -90, 180, 90]
                },
                callbackKey: 'jsoncallback',
                format: new OpenLayers.Format.Flickr()
            }),
            styleMap: new OpenLayers.StyleMap({
                "default": style,
                "select": {
                    fillColor: "#8aeeef",
                    strokeColor: "#32a8a9"
                }
            })
        });

		this.map.addLayer(layer);
		var select = new OpenLayers.Control.SelectFeature(
            layer, {hover: false}
        );
        this.map.addControl(select);
        select.activate();
        layer.events.on({"featureselected": _.bind(this.onPhotoFeatureSelected, this)});
	},
	onPhotoFeatureSelected: function(event) {
		if (event.feature.cluster.length > 1) {
			var bounds = new OpenLayers.Bounds();
			for (var i = 0; i < event.feature.cluster.length; i++) {
				bounds.extend(event.feature.cluster[i].geometry.getBounds());
			}
			this.map.zoomToExtent(bounds);
		} else {

		}
        // clear previous photo list and create new one
        $("photoList").innerHTML = "";
    }
});

var HomeSidebarView = Backbone.View.extend({
	template: null,
	el: $("#sidebar"),
	initialize: function(options) {
		this.template = _.template($("#homeSidebar").html());
	},
	render: function() {
		$(this.el).html(this.template());
	},
	teardown: function() {

	}
});

var UploadPhotoView = Backbone.View.extend({
	template: null,
	el: $("#sidebar"),
	initialize: function(options) {
		this.template = _.template($("#uploadSidebar").html());
	},
	render: function() {
		$(this.el).html(this.template());
	},
	teardown: function() {

	}
});

var logger = {
	logi: function(msg) {
		if (typeof(console) != 'undefined')
			console.log(msg);
	},
	logw: function(msg) {
		if (typeof(console) != 'undefined')
			console.warn(msg);
	},
	loge: function(msg) {
		if (typeof(console) != 'undefined')
			console.error(msg);
	}
}

var AppRouter = Backbone.Router.extend({
	mapView: null,
	sidebarView: null,
	routes: {
		"home": "home",
		"upload": "upload",
		"*path": "defaultRoute"
	},
	setMapView: function() {
		if (this.mapView == null) {
			this.mapView = new MapView();
			this.mapView.render();
		}
	},
	setSidebar: function(view) {
		if (this.sidebarView != null)
			this.sidebarView.teardown();
		this.sidebarView = view;
		this.sidebarView.render();
	},
	home: function() {
		logger.logi("route: home");
		this.setMapView();
		this.setSidebar(new HomeSidebarView());
	},
	upload: function() {
		logger.logi("route: upload");

		this.setMapView();
		this.setSidebar(new UploadPhotoView());
	},
	defaultRoute: function() {
		logger.logi("unknown route. Going home");
		this.home();
	}
});

var app = {
	initialize: function() {
		$('[data-toggle=offcanvas]').click(function() {
		    $('.row-offcanvas').toggleClass('active');
		});

		var router = new AppRouter();
		Backbone.history.start();
	}
};

$(document).ready(function() {
	app.initialize();
});