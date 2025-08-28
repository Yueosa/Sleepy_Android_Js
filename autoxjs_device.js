/*
autoxjs_device.js
使用 Autox.js 编写的安卓自动更新状态脚本
*/

// config start
const API_URL = "server"; // 你的完整 API 地址，以 `/device/set` 结尾
const SECRET = "secret"; // 你的 secret
const ID = "deviceid"; // 你的设备 id, 唯一
const SHOW_NAME = "devicename"; // 你的设备名称, 将显示在网页上
const CHECK_INTERVAL = "1000"; // 检查间隔 (毫秒, 1000ms=1s)
const APP_BLACKLIST = ["微信输入法"]
// config end

auto.waitFor(); // 等待无障碍

// 替换了 secret 的日志, 同时添加前缀
function log(msg) {
    try {
        console.log(`[sleepyc] ${msg.replace(SECRET, "[REPLACED]")}`);
    } catch (e) {
        console.log(`[sleepyc] ${msg}`);
    }
}
function error(msg) {
    try {
        console.error(msg.replace(SECRET, "[REPLACED]"));
    } catch (e) {
        console.error(msg);
    }
}

var last_status = "";

function check_status() {
    /*
    检查状态并返回 app_name (如未在使用则返回空)
    [Tip] 如有调试需要可自行取消 log 注释
    */
    // log(`[check] screen status: ${device.isScreenOn()}`);
    if (!device.isScreenOn()) {
        return "";
    }
    var app_package = currentPackage(); // 应用包名
    // log(`[check] app_package: '${app_package}'`);
    var app_name = app.getAppName(app_package); // 应用名称
    // log(`[check] app_name: '${app_name}'`);
    var battery = device.getBattery(); // 电池百分比
    // log(`[check] battery: ${battery}%`);

    if (!app_name || APP_BLACKLIST.includes(app_name)) return "";
    
    // 判断设备充电状态
    if (device.isCharging()) {
        var retname = `电量 [${battery}% +] ${app_name}`;
    } else {
        var retname = `电量 [${battery}%] ${app_name}`;
    }
    if (!app_name) {
        retname = "";
    }
    return retname;
}

function buildQueryString(params) {
    /*
    构建URL查询字符串
    */
    return Object.keys(params)
        .map((key) => encodeURIComponent(key) + "=" + encodeURIComponent(params[key]))
        .join("&");
}

function send_status() {
    /*
    发送 check_status() 的返回
    */
    var app_name = check_status();
    log(`ret app_name: '${app_name}'`);

    // 判断是否与上次相同
    if (app_name == last_status) {
        log("same as last status, bypass request");
        return;
    }
    last_status = app_name;
    // 判断 using
    if (app_name == "") {
        log("using: false");
        var using = false;
    } else {
        log("using: true");
        var using = true;
    }

    // GET to api
    log(`Status string: '${app_name}'`);
    const params = {
        secret: SECRET,
        id: ID,
        show_name: SHOW_NAME,
        using: using,
        app_name: app_name,
    };
    const queryString = buildQueryString(params);
    const fullUrl = API_URL + "?" + queryString;
    log(`GET ${fullUrl}`);
    r = http.get(fullUrl);
    log(`response: ${r.body.string()}`);
}

// 程序退出后上报停止事件
events.on("exit", function () {
    log("Script exits, uploading using = false");
    toast("[sleepy] 脚本已停止, 上报中");
    // GET to api
    const params = {
        secret: SECRET,
        id: ID,
        show_name: SHOW_NAME,
        using: false,
        app_name: "[Client Exited]", // using 为 false 时前端不会显示这个, 而是 '未在使用'
    };
    const queryString = buildQueryString(params);
    const fullUrl = API_URL + "?" + queryString;
    log(`GET ${fullUrl}`);
    try {
        r = http.get(fullUrl);
        log(`response: ${r.body.string()}`);
        toast("[sleepy] 上报成功");
    } catch (e) {
        error(`Error when uploading: ${e}`);
        toast(`[sleepy] 上报失败! 请检查控制台日志`);
    }
});

while (true) {
    log("---------- Run\n");
    try {
        send_status();
    } catch (e) {
        error(`ERROR sending status: ${e}`);
    }
    sleep(CHECK_INTERVAL);
}
