const apiResource = require("protractor-api-resource").ProtractorApiResource;
describe("Search for cookie monster cupckakes using API", function () {
    var apiClient, serviceEnpoints = {
        getSearch: {
            path: "/api/search?key=:apiKey:&q=:searchTerm:"
        },
    };
    beforeAll(function () {
        apiClient = new apiResource("https://www.food2fork.com/");
        apiClient.registerService(serviceEnpoints);
    });
    it("Verify proper results o from api search", function () {
        var expectedResponse = { "count": 1, "recipes": [{ "publisher": "BBC Good Food", "f2f_url": "http://food2fork.com/view/9089e3", "title": "Cookie Monster cupcakes", "source_url": "http://www.bbcgoodfood.com/recipes/873655/cookie-monster-cupcakes", "recipe_id": "9089e3", "image_url": "http://static.food2fork.com/604133_mediumd392.jpg", "social_rank": 100.0, "publisher_url": "http://www.bbcgoodfood.com" }] };
        apiClient.getSearch({ apiKey: "e676ea4152b2077f7e7bef634e232fff", searchTerm: "cookie monster cupcakes" }).toJSON().then(function (actualResponse) {
            expect(actualResponse).toEqual(expectedResponse);
        });
    });
});
