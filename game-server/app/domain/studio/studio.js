var pomelo = require('pomelo');
var channelUtil = require('../../util/channelUtil');
var MessageService = require('../../services/messageService');
var WYMusicService = require('../../services/wyMusicService.js');
var ProxyService = require('../../services/proxyService.js');

var studio = function (opts) {
    this.studioId = opts.id;

    this.users = {};
    this.playerList = {};
    this.songs = [];
    this.playingSong = null;
    this.channel = null;
}

module.exports = studio;

studio.prototype.getChannel = function () {
    if (!this.channel) {
        var channelName = channelUtil.getStudioChannelName(this.studioId);
        this.channel = pomelo.app.get('channelService').getChannel(channelName, true);
    }

    return this.channel;
};

studio.prototype.pushByUserName = function (userName, route, msg, cb) {
    var user = this.getUser(userName);
    if (!user) {
        cb(new Error('user[' + userName + '] is not in this studio'));
        return;
    }
    MessageService.pushMessageToUser({ uid: user.name, sid: user.serverId }, route, msg);
    pomelo.app.get('channelService').pushMessageByUids(route, msg, [{ uid: user.userName, sid: user.serverId }], cb);
};

studio.prototype.getPlayerMusicList = function () {
    var playerList = this.playerList;
    var songs = this.songs;
    var list = [];
    for (var n in songs) {
        list.unshift(playerList[songs[n].id]);
    }
    return list;
};

studio.prototype.getMusic = function (id, cb) {
    var music = this.playerList[id];
    if (!music) {
        cb('music not exist! ');
        return;
    }
    return music;
};

studio.prototype.addMusicById = function (id, userName, cb) {
    var self = this;
    if (pomelo.app.get('appConfig').useProxy) {
        ProxyService.getIp(function (err, ip) {
            WYMusicService.getMusicById(id, ip, self.addMusic.bind(self, userName, cb));
        });
    }
    else {
        WYMusicService.getMusicById(id, null, self.addMusic.bind(self, userName, cb));
    }
}

studio.prototype.addMusicByUrl = function (url, userName, cb) {
    var self = this;
    if (pomelo.app.get('appConfig').useProxy) {
        ProxyService.getIp(function (err, ip) {
            WYMusicService.getMusicByUrl(url, ip, self.addMusic.bind(self, userName, cb));
        });
    }
    else {
        WYMusicService.getMusicByUrl(url, null, self.addMusic.bind(self, userName, cb));
    }
};

studio.prototype.addMusic = function (userName, cb, err, music) {
    var self = this;
    if (!!err) {
        cb('get music by url error! ');
        return;
    }
    music.orderer = userName;
    if (!self.playerList[music.id]) {
        self.songs.push(music);
        self.playerList[music.id] = music;
        self.getChannel().pushMessage('onMusicAdd', music, cb);
    }
    else {
        if (music.resourceUrl) {
            if (!self.playerList[music.id].resourceUrl || self.playerList[music.id].resourceUrl == "") {
                self.playerList[music.id] = music;
                self.getChannel().pushMessage('onMusicAdd', music, cb);
            }
            else {
                cb('music already existed! ');
                return;
            }
        } else {
            self.getChannel().pushMessage('onMusicAdd', null, cb);
        }
    }
}

studio.prototype.importMusic = function (list, userName, cb) {
    var self = this;
    var playerList = this.playerList;
    var songs = this.songs;
    for (var n in list) {
        if (!list[n].resourceUrl || list[n].resourceUrl == "") {
            self.addMusicById(list[n].id, userName, cb);
        }
        else {
            if (!playerList[list[n].id]) {
                songs.push(list[n]);
                playerList[list[n].id] = list[n];
                self.getChannel().pushMessage('onMusicAdd', list[n], cb);
            }
            else {
                playerList[list[n].id] = list[n];
            }
        }
    }
}

studio.prototype.playMusic = function (id, userName, cb) {
    var music = this.playerList[id];
    if (!music) {
        cb('music not exist! ');
        return;
    }
    music.playby = userName;
    this.playingSong = music;
    this.getChannel().pushMessage('onMusicPlay', music, cb);
};

studio.prototype.removeMusic = function (id, userName, cb) {
    var songs = this.songs;
    var music = this.playerList[id];
    delete this.playerList[id];
    for (var n in songs) {
        if (songs[n].id == id) {
            songs.splice(n, 1);
            break;
        }
    }
    if (this.playingSong) {
        if (this.playingSong.id == id) {
            this.playingSong = null;
        }
    }
    music.deleter = userName;
    this.getChannel().pushMessage('onMusicRemove', music, cb);
};

studio.prototype.getUser = function (userName) {
    return this.users[userName];
};

studio.prototype.addUser = function (user) {
    this.users[user.name] = user;
    this.getChannel().add(user.name, user.serverId);
};

studio.prototype.removeUser = function (userName) {
    var user = this.users[userName];
    this.getChannel().leave(user.name, user.serverId);
    delete this.users[userName];
};

studio.prototype.getPlayingSong = function () {
    return this.playingSong;
}
