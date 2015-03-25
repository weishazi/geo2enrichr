App.View.GeneLists = Backbone.View.extend({

    tagName: 'table',

    template: '' +
        '<caption>External Links and Downloads</caption>' +
        '<thead>' +
            '<tr>' +
                '<td>Direction</td>' +
                '<td>Gene lists</td>' +
                '<td>Links to Enrichr</td>' +
            '</tr>' +
        '</thead>',

    initialize: function(genelists) {
        this.$el.append(this.template);
        _.each(genelists, function(gl) {
            var gl = new App.View.GeneList({
                text_file: gl.text_file,
                enrichr_link: gl.enrichr_link,
                direction: gl.direction
            });
            this.$el.append(gl.el);
        }, this);
    }
});
