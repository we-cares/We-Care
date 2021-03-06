var CountryModel = Backbone.Model.extend({
  url: '/issues',
  initialize: function(name, mapModel) {
    this.set('countryName', name);
    this.set('mapModel', mapModel);
    this.set('selected', false);

    this.on('selection', function() {
      this.set('selected', true);
      this.get('mapModel').updateCountry(this)
    }, this);
    this.on('deselection', function() {
      this.set('selected', false);
      this.get('mapModel').removeSelection()
    }, this)
  },
  getData: function() {
    var context = this;
    this.fetch({
      data: $.param({
        country: this.get('countryName')
      }),
      success: function() {
        context.trigger('dataLoaded', this);
      },
      error: function() {
        console.log('Error fetching country data');
      }
    });
  }
});
