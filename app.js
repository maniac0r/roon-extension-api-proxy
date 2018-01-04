var RoonApi          = require("node-roon-api");
var RoonApiTransport = require("node-roon-api-transport");
var RoonApiStatus    = require("node-roon-api-status");
var RoonApiImage     = require("node-roon-api-image");
var RoonApiSettings  = require('node-roon-api-settings');
var RoonApiBrowse    = require("node-roon-api-browse");

var path = require('path');
var transport;

var express = require('express');
var http = require('http');

var app = express();
var server = http.createServer(app);

app.use(express.static(path.join(__dirname, '')));

app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  next();
});


var core;
var zones = [];
var last_change;
var timeout;

var roon = new RoonApi({
   extension_id:        'marcelveldt.roon-api-proxy',
   display_name:        "Restfull api proxy to Roon JS API",
   display_version:     "1.0.0",
   publisher:           'marcelveldt',
   email:               '',
   log_level:           'none',

   core_paired: function(core_) {
      core = core_;
      transport = core_.services.RoonApiTransport;
      
      //listen for zone/output changes callback
      transport.subscribe_zones((response, msg) => {
        last_change = Date.now();
        if (response == "Subscribed") {
            let curZones = msg.zones.reduce((p,e) => (p[e.zone_id] = e) && p, {});
            msg.zones.forEach(e => { curZones[e.zone_id].last_changed = last_change; })
            zones = curZones;
        } else if (response == "Changed") {
              if (msg.zones_removed) {
                msg.zones_removed.forEach(e => {
                    delete(zones[e]);
                })
              }
              if (msg.zones_added) {
                msg.zones_added.forEach(e => {
                    zones[e.zone_id] = e;
                    zones[e.zone_id].last_changed = last_change;
                });
              }
              if (msg.zones_changed) {
                msg.zones_changed.forEach(e => {
                    zones[e.zone_id] = e;
                    zones[e.zone_id].last_changed = last_change;
                });
              }
          }
      });
    },

    core_unpaired: function(core_) {
    }
});

var mysettings = roon.load_config("settings") || {
    webport: "3006",
};

function makelayout(settings) {
    var l = {
      values:    settings,
        layout:    [],
        has_error: false
    };
    l.layout.push({
        type:      "string",
        title:     "HTTP Port",
        maxlength: 256,
        setting:   "webport",
    });
    return l;
}

var svc_settings = new RoonApiSettings(roon, {
    get_settings: function(cb) {
        cb(makelayout(mysettings));
    },
    save_settings: function(req, isdryrun, settings) {
    let l = makelayout(settings.values);
        req.send_complete(l.has_error ? "NotValid" : "Success", { settings: l });

        if (!isdryrun && !l.has_error) {
            var oldport = mysettings.webport;
            mysettings = l.values;
            svc_settings.update_settings(l);
            if (oldport != mysettings.webport) change_web_port(mysettings.webport);
            roon.save_config("settings", mysettings);
        }
    }
});

var svc_status = new RoonApiStatus(roon);

roon.init_services({
   required_services: [ RoonApiTransport, RoonApiImage, RoonApiBrowse ],
   provided_services: [ svc_status, svc_settings ],
});

svc_status.set_status("Extension enabled", false);
roon.start_discovery();


function change_web_port() {
   server.close();
   server.listen(mysettings.webport, function() {
   console.log('Listening on port: ' + mysettings.webport);
   });
}

server.listen(mysettings.webport, function() {
   console.log('Listening on port: ' + mysettings.webport);
});



// --------------------- http gets -------------------------

app.get('/core', function(req, res) {
  res.send({
    "id": core.core_id,
    "display_name": core.display_name,
    "display_version": core.display_version
  });
});

app.get('/zones', function(req, res) {
  res.send({
    "last_change": last_change,
    "zones": zones
  });
});

app.get('/zone', function(req, res) {
  res.send(zones[req.query['zone']])
});

app.get('/control', function(req, res) {
    core.services.RoonApiTransport.control(req.query['zone'], req.query['control']);
   res.send({
    "status": "success"
  })
});

app.get('/seek', function(req, res) {
    core.services.RoonApiTransport.seek(req.query['zone'], "absolute", req.query['seek']);
   res.send({
    "status": "success"
  })
});

app.get('/mute', function(req, res) {
  core.services.RoonApiTransport.mute(req.query['output'], req.query['how']);
  res.send({
    "status": "success"
  })
});

app.get('/change_volume', function(req, res) {
  core.services.RoonApiTransport.change_volume(req.query['output'], "absolute", req.query['volume']);
  res.send({
    "status": "success"
  })
});

app.get('/change_settings', function(req, res) {
  var settings = {
    [req.query['setting']]: req.query['value']
  };
  core.services.RoonApiTransport.change_settings(req.query['zone'], settings);
  res.send({
    "status": "success"
  })
});

app.get('/convenience_switch', function(req, res) {
  core.services.RoonApiTransport.convenience_switch(req.query['output'], {} );
  res.send({
    "status": "success"
  })
});

app.get('/standby', function(req, res) {
  core.services.RoonApiTransport.standby(req.query['output'], {} );
  res.send({
    "status": "success"
  })
});

app.get('/toggle_standby', function(req, res) {
  core.services.RoonApiTransport.toggle_standby(req.query['output'], {} );
  res.send({
    "status": "success"
  })
});

app.get('/group_outputs', function(req, res) {
  core.services.RoonApiTransport.group_outputs(req.query["outputs"]);
  res.send({
    "status": "success"
  })
});

app.get('/ungroup_outputs', function(req, res) {
  core.services.RoonApiTransport.ungroup_outputs(req.query["outputs"]);
  res.send({
    "status": "success"
  })
});

app.get('/add_to_group', function(req, res) {
  ///append output to existing (grouped) zone
  var sync_outputs = [];
  zones[req.query['zone']]['outputs'].forEach(e => {
    sync_outputs.push(e['output_id']);
  })
  sync_outputs.push(req.query["output"]);
  core.services.RoonApiTransport.group_outputs(sync_outputs);
  res.send({
    "status": "success"
  })
});

app.get('/ungroup_output', function(req, res) {
  ///remove single output from grouped zone
  var obj = [req.query["output"]];
  core.services.RoonApiTransport.ungroup_outputs(obj);
  res.send({
    "status": "success"
  })
});

app.get('/image', function( req, res ) {
  core.services.RoonApiImage.get_image(req.query['image_key'], req.query, function(cb, contentType, body) {
      res.contentType = contentType;
      res.writeHead(200, {'Content-Type': contentType });
      res.end(body, 'binary');
   });
});

app.get('/browse/search', function(req, res) {
   refresh_browse( req.query['zone'], { input: req.query['searchstring'] }, 0, 100, function(myList) {
    res.send({
      "list": myList
    })
  });
});

app.get('/browse/by_key', function(req, res) {
   refresh_browse( req.query['zone'], { item_key: req.query['item_key'] }, 0, 100, function(myList) {
   res.send({
     "list": myList
   })
  });
});

app.get('/browse/up', function(req, res) {
   refresh_browse( req.query['zone'], { pop_levels: 1 }, 1, 100,  function(myList) {
    res.send({
      "list": myList
    })
  });

});

app.get('/browse/home', function(req, res) {
   refresh_browse( req.query['zone'], { pop_all: true }, 1, 100, function(myList) {
   res.send({
     "list": myList
    })
  });
});

app.get('/browse/refresh', function(req, res) {
   refresh_browse( req.query['zone'], { refresh_list: true }, 0, 0, function(myList) {
   res.send({
     "list": myList
    })
  });
});

app.get('/browse/playlists', function(req, res) {
   var result_playlists = [];
   var result_radios = [];
   refresh_browse( req.query['zone'], { pop_all: true }, 0, 0, function(mainlist) {
        /// playlists
        refresh_browse( req.query['zone'], { item_key: mainlist[1]['item_key'] }, 0, 0, function(playlists) {
            playlists.forEach(e => result_playlists.push(e['title']))
            refresh_browse( req.query['zone'], { item_key: mainlist[2]['item_key'] }, 0, 0, function(radios) {
                radios.forEach(e => result_radios.push(e['title']))
                res.send({
                    "playlists": result_playlists,
                    "radios": result_radios
                })
            });
        });
    });
});

app.get('/play/playlist', function(req, res) {
   play_by_title( req.query['zone'], req.query["name"], 1, 0, 0, function(actionresult) {
   res.send({ actionresult })
  });
});
app.get('/play/radio', function(req, res) {
   play_by_title( req.query['zone'], req.query["name"], 2, 0, 0, function(actionresult) {
   res.send({ actionresult })
  });
});
app.get('/play/genre', function(req, res) {
   play_by_title( req.query['zone'], req.query["name"], 3, 0, 0, function(actionresult) {
   res.send({ actionresult })
  });
});

app.get('/browse', function(req, res) {
   core.services.RoonApiBrowse.browse(opts, (err, r) => {
        console.log(r);
        if (r.action == 'list') {
            core.services.RoonApiBrowse.load({
                hierarchy:          "browse",
                offset:             0,
                set_display_offset: 100,
            }, (err, r) => {
                items = r.items;
                cb(r.items);
            });
        }
    });
});

function play_by_title(zone_id, title, level1, level2, level3, cb) {
   refresh_browse( zone_id, { pop_all: true }, 0, 0, function(mainlist) {
        refresh_browse( zone_id, { item_key: mainlist[level1]['item_key'] }, 0, 0, function(playlists) {
            playlists.forEach(function(entry) {
                console.log(entry);
                if (entry["title"].toLowerCase() == title.toLowerCase()) {
                    console.log("entry found");
                    refresh_browse( zone_id, { item_key: entry['item_key'] }, 0, 0, function(details) {
                        console.log(details);
                        refresh_browse( zone_id, { item_key: details[level2]['item_key'] }, 0, 0, function(details2) {
                            console.log(details2);
                            // action (0=play now, 1=radio, 2=add next, 3=queue)
                            refresh_browse( zone_id, { item_key: details2[level3]['item_key'] }, 0, 0, function(details3) { })
                        });
                    });
                }
            })
        });
    });
   cb({ "status": "success" });
};


// --------------- Helper Functions -----------------------

function refresh_browse(zone_id, opts, page, listPerPage, cb) {
    var items = [];
    opts = Object.assign({
        hierarchy:          "browse",
        zone_or_output_id:  zone_id,
    }, opts);

    core.services.RoonApiBrowse.browse(opts, (err, r) => {
        if (err) { console.log(err, r); return; }

        if (r.action == 'list') {
            page = ( page - 1 ) * listPerPage;

            core.services.RoonApiBrowse.load({
                hierarchy:          "browse",
                offset:             page,
                set_display_offset: listPerPage,
            }, (err, r) => {
                items = r.items;
                cb(r.items);
            });
        }
    });
}
