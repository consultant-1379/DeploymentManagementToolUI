define(['application/Application'], function (Application) {

    describe("Application", function () {

        it("1 Check that Places is defined", function () {
            expect(Application.prototype.places).toBeDefined();
        });
    });

});