var MapView = Backbone.View.extend({
  el: '' +
    '<div>' +
    '  <div class="onoffswitch">' +
    '    <input type="checkbox" name="onoffswitch" class="onoffswitch-checkbox" id="myonoffswitch" checked>' +
    '    <label class="onoffswitch-label" for="myonoffswitch">' +
    '      <span class="onoffswitch-inner"></span>' +
    '      <span class="onoffswitch-switch"></span>' +
    '    </label>' +
    '  </div>' +
    '  <button class="breaking-news">Hide Breaking News</button>' +
    '  <div id="map"></div>' +
    '</div>',

  events: {
    'click #myonoffswitch': 'toggleNewsSource'
  },

  advisoryKey: {
    "0": "white",
    "1": "#ffff38",
    "2": "#FF9900",
    "3": "#FF0000"
  },

  initialize: function() {
    this.newsSource = 'NYT';
    this.button = new Button({
      el: this.$el.find('button')
    });
    this.button.on('hideNews', function() {
      this.$el.find('.onoffswitch').hide();
      this.removeHeadlines();
    }, this);
    this.button.on('showNews', function() {
      this.$el.find('.onoffswitch').show();
      this.model.separateHeadlines();
    }, this)
    this.model.on('warningsLoaded', this.renderMap, this);
    this.model.on('separateHeadlines', this.separateHeadlines, this);
  },

  renderMap: function() {
    console.log("in render");
    var context = this;
    var mwidth = $("#map").width(),
      width = 908,
      height = 525,
      country,
      state;

    var projection = d3.geo.mercator()
      .scale(150)
      .translate([width / 2, height / 1.5]);

    var path = d3.geo.path()
      .projection(projection);

    var svg = d3.select("#map").append("svg")
      .attr("preserveAspectRatio", "xMidYMid")
      .attr("viewBox", "0 0 " + width + " " + height)
      .attr("width", mwidth)
      .attr("height", mwidth * height / width)

    svg.append('foreignObject')
      .attr('class', 'mapLogo')
      .attr({
        width: 100
      })
      .attr("x", '5')
      .attr("y", '5')
      .html('<div class="logo-map-small"></div>');

    svg.append('foreignObject')
      .attr('class', 'map-bn-container')
      .attr({
        width: 210
      })
      .attr("x", '5')
      .attr("y", '10')
      .html('<div class="toggle-source-news">' +
            '  <div class="onoffswitch">' +
            '    <input type="checkbox" name="map-onoffswitch" class="onoffswitch-checkbox" id="myonoffswitch-map" checked>' +
            '    <label class="onoffswitch-label" for="myonoffswitch-map">' +
            '      <span class="onoffswitch-inner"></span>' +
            '      <span class="onoffswitch-switch"></span>' +
            '    </label>' +
            '  </div>' +
            '</div>' +
            '<div class="map-breaking-news"><button class="icon"></button></div>');

    // svg.append('foreignObject')
    //   .attr('class', 'toggle-bn-container')
    //   .attr({
    //     width: 180
    //   })
    //   .attr("x", '5')
    //   .attr("y", '10')
    //   .html();

    svg.append("rect")
      .attr("class", "background")
      .attr("width", width)
      .attr("height", height);

    var g = svg.append("g")
      .attr("id", "container");

    d3.json("../../json/countries.topo.json", function(error, us) {
      g.append("g")
        .attr("id", "countries")
        .selectAll("path")
        .data(topojson.feature(us, us.objects.countries).features)
        .enter()
        .append("path")
        .attr("d", path)
        .each(function(d) {
          var countryModel = new CountryModel(d.id, context.model);
          var countryView = new CountryView({
            model: countryModel,
            el: this
          });
          context.model.get('countryCollection').push(countryModel);
          countryView.on('countryClicked', function(country) {
            countryClicked(d);
          }, this);
        })
        .style("fill", function(d) {
          return this.advisoryKey[this.model.get(d.id)] ? this.advisoryKey[this.model.get(d.id)] : "white";
        }.bind(context));
    });

    function zoom(xyz) {
      g.transition()
        .duration(750)
        .attr("transform", "translate(" + projection.translate() + ")scale(" + xyz[2] + ")translate(-" + xyz[0] + ",-" + xyz[1] + ")")
        .selectAll(["#countries", "#states", "#cities"])
        .style("stroke-width", 1.0 / xyz[2] + "px")
        .selectAll(".city")
        .attr("d", path.pointRadius(20.0 / xyz[2]));
    }

    function getXYZ(d) {
      var bounds = path.bounds(d);
      var w_scale = (bounds[1][0] - bounds[0][0]) / width;
      var h_scale = (bounds[1][1] - bounds[0][1]) / height;
      var z = .96 / Math.max(w_scale, h_scale);
      // moved center zoom point to the right to make room for a bigger tooltip
      var x = (bounds[1][0] + bounds[0][0]) / 2 - 15;
      var y = (bounds[1][1] + bounds[0][1]) / 2 + (height / z / 6);
      return [x, y, z];
    }

    function countryClicked(d) {
      g.selectAll(["#states", "#cities"]).remove();
      state = null;

      if (country) {
        g.selectAll("#" + country.id).style('display', null)
          .classed('selected', false);
      }
      if (d && country !== d) {
        context.$el.find('button').hide();
        context.$el.find('.onoffswitch').hide();
        context.removeHeadlines();
        var xyz = getXYZ(d);
        country = d;
        zoom(xyz);
      } else {
        var xyz = [width / 2, height / 1.5, 1];
        country = null;
        zoom(xyz);
        context.$el.find('button').show();
        if (!context.button.newsDisabled) {
          context.$el.find('.onoffswitch').show();
          setTimeout(context.model.separateHeadlines.bind(context.model), 1000);
        }
      }
    }

    $(window).resize(function() {
      var w = $("#map").width();
      svg.attr("width", w);
      svg.attr("height", w * height / width);
    });

    this.model.get('newsModel').trigger('getNews');
  },

  separateHeadlines: function(breakingNews) {
    var context = this;
    var dataNodes = [];
    var dataLinks = [];
    toRender = breakingNews.filter(function(article) {
      return article.source === context.newsSource;
    });
    toRender.forEach(function(article) {
      var country = context.model.get('countryCollection').findWhere({
        countryName: article.location[0]
      });
      if (country) {
        var newNodes = [{
          x: country.get('x'),
          y: country.get('y'),
          class: 'breakingNews',
          countryName: article.location[0],
          headline: article.headline,
          url: article.url
        }, {
          x: country.get('x'),
          y: country.get('y'),
          class: 'fixedNode',
          fixed: true
        }];
        dataNodes = dataNodes.concat(newNodes);
        var link = {
          source: dataNodes.length - 1,
          target: dataNodes.length - 2
        };
        dataLinks.push(link);
      }
    });

    var force = d3.layout.force()
      .size([908, 525])
      .nodes(dataNodes)
      .links(dataLinks)
      .linkDistance(5)
      .gravity(.3)
      .charge(function(node) {
        return node.class === 'breakingNews' ? 30 : -30
      })

    force.on('tick', function(e, o) {
      var q = d3.geom.quadtree(dataNodes),
        i = 0,
        n = dataNodes.length;

      while (++i < n) {
        if (!dataNodes[i].fixed) {
          q.visit(collide(dataNodes[i]));
        }
      }

      nodes.transition().ease('linear').duration(500)
        .attr('x', function(d) {
          return d.x;
        })
        .attr('y', function(d) {
          return d.y;
        });
      links.transition().ease('linear').duration(500)
        .attr('x1', function(d) {
          return d.source.x;
        })
        .attr('y1', function(d) {
          return d.source.y;
        })
        .attr('x2', function(d) {
          return d.target.x + 50;
        })
        .attr('y2', function(d) {
          return d.target.y + 10;
        });
    });
    var collide = function(node) {
      var nx1 = node.x;
      var nx2 = node.x + 100;
      var ny1 = node.y;
      var ny2 = node.y + 100;
      return function(quad, x1, y1, x2, y2) {
        if (quad.point && (quad.point !== node)) {
          if (!quad.point.fixed) {
            var x = (node.x + 50) - (quad.point.x + 50),
              y = (node.y + 50) - (quad.point.y + 50),
              l = Math.sqrt(x * x + y * y),
              r = context.newsSource === 'NYT' ? 110 : 170; //node.radius + quad.point.radius;
            if (l < r) {
              l = (l - r) / l * .5;
              node.x -= x *= l;
              node.y -= y *= l;
              quad.point.x += x;
              quad.point.y += y;
            }
          }
          return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        }
      };
    };

    force.start();

    links = d3.select("#map").select("svg").selectAll('.link')
      .data(dataLinks)
      .enter().append('line')
      .attr('class', 'link')
      .attr('x1', function(d) {
        return d.source.x;
      })
      .attr('y1', function(d) {
        return d.source.y;
      })
      .attr('x2', function(d) {
        return d.target.x + 50;
      })
      .attr('y2', function(d) {
        return d.target.y + 10;
      })
      .attr('stroke', 'black')
      .attr("stroke-width", 1);

    nodes = d3.select("#map").select("svg").selectAll('.node')
      .data(dataNodes)
      .enter().append('foreignObject')
      .attr("width", function(d) {
        return context.newsSource === "NYT" ? 100 : 150;
      })
      .attr("x", function(d) {
        return d.x;
      })
      .attr("y", function(d) {
        return d.y;
      })
      .attr('fixed', function(d) {
        return d.fixed;
      })
      .attr('class', function(d) {
        return d.fixed ? "" : "headline";
      })
      .html(function(d) {
        if (d.headline) {
          return '' +
            '<div class="breaking-news-container">' +
            '  <div class="country-name">' + d.countryName + '</div>' +
            '  <div class"breaking-news-headline><a href="' + d.url + '">' + d.headline + '</a></div>' +
            '</div>';
        }
      })
  },

  toggleNewsSource: function() {
    this.newsSource === 'NYT' ? this.renderReddit() : this.renderNYT();
  },
  removeHeadlines: function() {
    d3.selectAll('.headline').remove();
    d3.selectAll('.link').remove();
  },
  renderNYT: function() {
    this.removeHeadlines();
    this.newsSource = 'NYT';
    if (!this.button.newsDisabled) {
      this.model.separateHeadlines();
    }
  },
  renderReddit: function() {
    this.removeHeadlines();
    this.newsSource = 'Reddit';
    if (!this.button.newsDisabled) {
      this.model.separateHeadlines();
    }
  }

});
