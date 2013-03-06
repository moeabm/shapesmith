requirejs.config({
    paths: {
        'underscore': 'node_modules/underscore/underscore',
        'backbone': 'node_modules/backbone/backbone',
    },
    shim: {
        'underscore': {
            exports: '_'
        },
        'backbone': {
            deps: ['underscore', 'jquery'],
            exports: 'Backbone'
        },
    },
});

requirejs([
        'jquery',
        'lib/jquery.mustache',
        'underscore',
        'backbone'
    ], function($, $$, _, Backbone) {

    var CreateModel = Backbone.Model.extend({

        initialize: function(options) {
            this.view = new CreateView({model: this});
        },

    });

    var CreateView = Backbone.View.extend({

        className: 'input-container',

        initialize: function() {
            this.render();
            $('#create').append(this.$el);
        },

        render: function() {
            var html = 
                '<input placeholder="new project (press return to create)" class="field" required="required">';
            this.$el.html(html);
        },

        events: {
            'keyup input': 'keyup'
        },

        keyup: function(event) {
            var newDesignName = this.$el.find('input').val().trim();
            if ((event.keyCode === 13) && (newDesignName.length)) {
                var that = this;
                $.ajax({
                    type: 'POST',
                    url: '/' + encodeURIComponent(globals.user)  + '/' + encodeURIComponent(newDesignName) + '/',
                    data: '{}',
                    dataType: 'json',
                    contentType: 'application/json',
                    success: function(response) {
                        console.log(response);
                        window.location.href = '/' + encodeURIComponent(globals.user) + 
                            '/' + encodeURIComponent(newDesignName) + 
                            '/modeller?commit=' + response.refs.heads.master + 
                            '&splash=true';
                    },
                    error: function(response) {
                        that.$el.find('input').addClass('error');
                    }
                });
            }
        },

    });

    var DesignModel = Backbone.Model.extend({

        initialize: function(design) {
            this.name = design.name;
            this.view = new PlaceholderView({model: this});
        },

        destroy: function() {
            this.view.remove();
        },

        updateDesign: function(design) {
            var placeholderView = this.view;
            var placeholderElement = placeholderView.$el;
            this.name = design.name;
            this.commit = design.commit;
            this.screenshot = design.screenshot;
            this.view = new DesignView({el: placeholderElement, model: this});
        },

    });

    var PlaceholderView = Backbone.View.extend({

        tagName: 'li',

        initialize: function() {
            this.render();
            $('#designs').prepend(this.$el);
        },

        render: function() {
            var template = 
                '<div class="design">' + 
                '<h2><span class="name">&nbsp;</span></h2><div class="preview">' +
                '<div class="screenshot loading"><div>loading...</div></div>' +
                '</div></div>';
            var view = {
            }
            this.$el.html($.mustache(template, view));
        },

    });

    var DesignView = Backbone.View.extend({

        tagName: 'li',

        initialize: function(options) {
            this.render();
        },

        render: function() {
            var template = 
                '<div class="design">' + 
                '<div class="delete"></div><h2><span class="name">{{name}}</span></h2><div class="placeholder"></div><div class="preview">' +
                '{{#imgsrc}}<div class="screenshot" style="background-image: url({{imgsrc}})"></div>{{/imgsrc}}' +
                '{{^imgsrc}}<div class="screenshot" style="background-image: url(/ui/images/empty_preview.png)"></div>{{/imgsrc}}' +
                '</div></div>';
            var view = {
                name: this.model.name,
                imgsrc: this.model.screenshot
            }
            this.$el.html($.mustache(template, view));
        },

        events: {
            'click .preview' : 'open',
            'click .delete' : 'delete',
            'click .name'   : 'rename',
        },

        delete: function(event) {
            event.stopPropagation();
            if (!this.$el.find('.confirm').length) {
                var html = '<div class="confirm"><span class="question">Are you sure?</span>' + 
                    '<div class="buttons">' +
                        '<input name="confirmdelete" type="button" value="Delete"/>' + 
                        '<input name="canceldelete" type="button" value="Don\'t delete"/>' + 
                    '</div></div>';

                this.$el.find('.placeholder').append(html);
                var that = this;
                this.$el.find('input[name="confirmdelete"]').click(function(event) {
                    that.confirmDelete.call(that, event);
                });
                this.$el.find('input[name="canceldelete"]').click(function(event) {
                    that.cancelDelete.call(that, event);
                });
            }
        },

        confirmDelete: function(event) {
            event.stopPropagation();
            var that = this;
            $.ajax({
                type: 'DELETE',
                url: '/' + encodeURIComponent(globals.user)  + '/' + encodeURIComponent(this.model.name) + '/',
                success: function(response) {
                    that.model.destroy();
                },
                error: function(response) {
                    console.error(response);
                }
            });
        },

        cancelDelete: function(event) {
            event.stopPropagation();
            this.$el.find('.placeholder').empty();
        },

        rename: function(event) {
            event.stopPropagation();
            this.$el.find('h2').html('<input name="rename" class="rename" value="' + this.model.name + '">')
            this.$el.find('h2 input').focus();
            var that = this;
            this.$el.find('input[name="rename"]').keyup(function(event) {
                if (event.keyCode === 13) {
                    that.tryRename.call(that, event);
                } else if (event.keyCode === 27) {
                    that.cancelRename.call(that, event);

                }
            });
        },

        cancelRename: function() {
            this.$el.find('h2').html('<span class="name">' + this.model.name + '</span>');
        },

        tryRename: function() {
            var newName = this.$el.find('input').val().trim();
            var that = this;
            if (newName.length) {
                $.ajax({
                    type: 'POST',
                    url: '/_api/' + encodeURIComponent(globals.user)  + '/' + encodeURIComponent(this.model.name) + '/',
                    data: JSON.stringify({newName: newName}),
                    dataType: 'json',
                    contentType: 'application/json',
                    success: function(response) {
                        that.model.name = newName;
                        that.render();
                    },
                    error: function(response) {
                        that.$el.find('input').addClass('error');
                    }
                });
            }
        },

        open: function() {
            var designUrl = '/' + encodeURIComponent(globals.user) + '/' + encodeURIComponent(this.model.name) + '/modeller';
            window.location = designUrl + '?commit=' + this.model.commit;
        },

    });

    $(document).ready(function() {

        // New design model
        new CreateModel();

        // Create models for designs
        $.getJSON('/_api/' + encodeURIComponent(globals.user) + '/designs.json', function(designs) {
            
            $('#designs .placeholder').remove();
            var designModels = {};
            designs.map(function(name) {
                designModels[name] = new DesignModel({name: name});

                var designURL = '/_api/' + encodeURIComponent(globals.user) +
                                '/' + encodeURIComponent(name) + '/refs';

                $.getJSON(designURL, function(data) {

                    var master = data.refs.heads.master;
                    if (_.isString(master)) {
                        // No screenshot, just a commit
                        designModels[name].updateDesign({name: name, commit: master});
                    } else {
                        designModels[name].updateDesign({name: name, commit: master.commit, screenshot: master.screenshot});
                    }

                });
            });
        }, function(err) {
            console.error(err);
        });
    });

});

