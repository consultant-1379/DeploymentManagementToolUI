define(['Titan'], function (Titan) {
    return Titan.Model.extend({
        init:function(){
            this.url= this.options.baseUrl
        }
    });
});