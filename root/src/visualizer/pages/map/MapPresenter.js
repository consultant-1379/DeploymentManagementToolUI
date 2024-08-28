define([
    'Titan',
    './MapView',
    './Map',
    './MapModel',
    '$'
], function (Titan, View, Map, Model, $) {
    return Titan.Presenter.extend({
        View: View,
        init: function () {
            this.model = this.create(Model);
            this.model.on('change', function(){
                this.createMap();

            }, this);
            this.model.fetch();
         },
        home: function(){
            this.responsiveLayoutOnLoad();
            if(this.widget){
                this.addWidget();
            }
        },
        addWidget: function() {
            this.view['root'].setWidget(this.widget);
        },
        createMap: function(){
            this.widget = this.create(Map, {data: this.model.get('data')});
            this.addWidget();
            $(".visualizer-map-loader").hide();
            $(".visualizer-map-helpbox").show();
            $(".visualizer-map-legendContainer").show();
            this.responsiveLayoutOnLoad();
        },
        responsiveLayoutOnLoad: function(){
            var browserWidth = parseInt(window.innerWidth);
            var result =  browserWidth - 450;
            $('.visualizer-map-holder').width(result);
            $('.visualizer-map-tree').width(result);
            $('.visualizer-map-tree svg').width(result);
            $('.visualizer-map-tree svg g.container rect.overlay').attr('width',function(){
                if(result < 920){return 920;}
                else{return result;}
            });

        }
    });
});