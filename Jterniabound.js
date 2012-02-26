//requires Character.js

var Keys = {backspace:8,tab:9,enter:13,shift:16,ctrl:17,alt:18,escape:27,space:32,left:37,up:38,right:39,down:40};

var Stage; //the canvas, we're gonna load it up with a bunch of flash-like game data like fps and scale factors
var stage; //its context
var updateLoop;
var pressed;
var assetLoadStack;
var assets;
var sprites;
var rooms;
var char;
var curRoom,destRoom;
var destX,destY;
var focus;
var chooser;
var bgm;

var initFinished;

function initialize(){
	Stage = document.getElementById("Stage");	
	Stage.scaleX = Stage.scaleY = 1;
	Stage.x = Stage.y = 0;
	Stage.fps = 30;
	Stage.fade = 0;
	Stage.fadeRate = 0.1;
	
	stage = Stage.getContext("2d");
	
	chooser = {choosing:false,choices:new Array(),choice:0,dialogs:new Array()};
	dialoger = {talking: false,queue:new Array(),dialog:new FontEngine()};
	assets = {};
	rooms = {};
	sprites = {};
	commands = {};
	pressed = new Array();
	
	loadAssets();
}

function finishInit(){
    if(initFinished) {
	return;
    }
    initFinished = true;
	buildSprites();
	buildRooms();
	buildFonts();
	buildActions();
	buildCommands();
	
	focus = char = sprites.karkat;
	curRoom = rooms.baseRoom;
    curRoom.initialize();
	char.becomePlayer();
	serialize();
	update(0);
}

function update(gameTime){
	//update stuff
	handleInputs();
	
	curRoom.update(gameTime);
	
	focusCamera();
	handleRoomChange();
	handleTextUpdates();
	
	//must be last
	updateLoop=setTimeout("update("+(gameTime+1)+")",1000/Stage.fps);
	draw(gameTime);
}

function draw(gameTime){
	stage.fillStyle = "rgb(0,0,0)";
	stage.fillRect(0,0,Stage.width,Stage.height);
	
	stage.save();
	stage.scale(Stage.scaleX,Stage.scaleY);
	stage.translate(-Stage.x,-Stage.y);
	
	curRoom.draw();
	drawChoices();
	
	stage.restore();
	drawDialog();
	
	stage.fillStyle = "rgba(0,0,0,"+Stage.fade+")";
	stage.fillRect(0,0,Stage.width,Stage.height);
}

onkeydown = function(e){
	if(chooser.choosing){
		if(e.keyCode == Keys.down){
			chooser.choice = (chooser.choice+1)%chooser.choices.length;
		}
		if(e.keyCode == Keys.up){
			chooser.choice = (chooser.choice-1+chooser.choices.length)%chooser.choices.length;
		}
		if(e.keyCode == Keys.space && !pressed[Keys.space]){
			performAction(chooser.choices[chooser.choice]);
			chooser.choosing = false;
		}
	}else if(dialoger.talking){
		if(e.keyCode == Keys.space && !pressed[Keys.space]){
			if(dialoger.dialog.isShowingAll()){
				//alert("cccc!");
				if(dialoger.dialog.nextBatch()){
					//alert("aaa!");
					dialoger.dialog.showSubText(0,0);
				}else{
					//alert("bbb!");
					if(dialoger.queue.length>0){
						var nextDialog = dialoger.queue.pop();
						dialoger.dialog.setText(nextDialog.substring(nextDialog.indexOf(" ")+1,nextDialog.length));
						dialoger.dialog.showSubText(0,0);
					}else{
						dialoger.talking = false;
					}
				}
			}else{
				dialoger.dialog.showAll();
			}
		}
	}else{
		if(e.keyCode == Keys.space && !pressed[Keys.space]){
			chooser.choices = new Array();
			if(char.facing=="Front"){
				chooser.choices = curRoom.queryActions(char,char.x,char.y+char.height/2+15);
			}else if(char.facing=="Back"){
				chooser.choices = curRoom.queryActions(char,char.x,char.y-char.height/2-15);
			}else if(char.facing=="Right"){
				chooser.choices = curRoom.queryActions(char,char.x+char.width/2+15,char.y);
			}else if(char.facing=="Left"){
				chooser.choices = curRoom.queryActions(char,char.x-char.width/2-15,char.y);
			}
			if(chooser.choices.length>0){
				beginChoosing();
			}
		}
	}
	pressed[e.keyCode] = true;
    return false;
}

onkeyup = function(e){
	pressed[e.keyCode] = false;
}

function drawLoader(){
	stage.fillStyle = "rgb(240,240,240)";
	stage.fillRect(0,0,Stage.width,Stage.height);
	stage.fillStyle = "rgb(200,0,0)"
	stage.font="30px Arial";
	stage.fillText("Loading Assets: "+(assetLoadStack.totalAssets-assetLoadStack.length)+"/"+assetLoadStack.totalAssets,100,200);
}

function handleInputs(){
	if(!chooser.choosing){
		if(pressed[Keys.down]){
			char.moveDown(curRoom);
		}else if(pressed[Keys.up]){
			char.moveUp(curRoom);
		}else if(pressed[Keys.left]){
			char.moveLeft(curRoom);
		}else if(pressed[Keys.right]){
			char.moveRight(curRoom);
		}else{
			char.idle();
		}
	}
}

function loadAssets(){
	assetLoadStack = new Array();
	assetLoadStack.totalAssets = 0;
	loadAsset("cgSheet","resources/CGsheetBig.png");
	loadAsset("compLabBG","resources/comlab-background.gif");
	loadAsset("compLabWalkable","resources/comlab-walkable.png");
    loadAudioAsset("karkatBGM", "resources/karkat.ogg", "resources/karkat.mp3");
    assets.karkatBGM.setLoopPoints(6.7);
    loadAudioAsset("tereziBGM", "resources/terezi.ogg", "resources/terezi.mp3");
    assets.tereziBGM.setLoopPoints(1.9);
	assets.compLabWalkable = [{x:70,y:270},{x:800,y:270},{x:800,y:820},{x:70,y:820}];
	assets.compLabWalkable.name = "compLabWalkable";
	drawLoader();
}

function loadAsset(name,path){
	assets[name] = new Image();
	assets[name].src = path;
	assets[name].onload = popLoad;
	assets[name].name = name;
	assetLoadStack.totalAssets++;
	assetLoadStack.push(assets[name]);
}

function loadAudioAsset(name) {
    assets[name] = new Audio();
    // no builtin onload function for audio
    assets[name].addEventListener('canplaythrough', popLoad);
    assets[name].name = name
    assets[name].preload = true;
    for (a=1; a < arguments.length; a++) {
	var tmp = document.createElement("source")
	tmp.src = arguments[a];
	console.log(tmp);
	assets[name].appendChild(tmp);
    }
    var tmpPointer = assets[name];
    assets[name].setLoopPoints = function(start, end) {
	tmpPointer.startLoop = start;
	tmpPointer.endLoop = end;
	tmpPointer.addEventListener('ended', function() {
	    tmpPointer.currentTime = start;
	}
				   );
	// do we need to have an end point? does that even make sense
    };
    assetLoadStack.totalAssets++;
    assetLoadStack.push(assets[name])
}

function popLoad(){
	assetLoadStack.pop();
	drawLoader();
	if(assetLoadStack.length==0){
		finishInit();
	}
}

function buildSprites(){
	sprites.karkat = new Character("karkat",300,501,45,21,-36,-87,66,96,assets.cgSheet);
	sprites.karclone = new Character("karclone",201,399,45,21,-36,-87,66,96,assets.cgSheet);
	sprites.karclone2 = new Character("karclone2",501,399,45,21,-36,-87,66,96,assets.cgSheet);
	sprites.compLabBG = new StaticSprite("compLabBG",0,0,null,null,null,null,assets.compLabBG);
}

function buildRooms(){
	rooms.baseRoom = new Room("baseRoom",sprites.compLabBG.width,sprites.compLabBG.height,
								assets.compLabWalkable);
	rooms.baseRoom.addSprite(sprites.karkat);
	rooms.baseRoom.addSprite(sprites.karclone);
	rooms.baseRoom.addSprite(sprites.compLabBG);
    rooms.baseRoom.setBGM(assets.karkatBGM);
	
	rooms.cloneRoom = new Room("cloneRoom",sprites.compLabBG.width,sprites.compLabBG.height,assets.compLabWalkable);
	rooms.cloneRoom.addSprite(sprites.karclone2);
	rooms.cloneRoom.addSprite(sprites.compLabBG);
    rooms.cloneRoom.setBGM(assets.tereziBGM);
}

function buildFonts(){
	dialoger.dialog.setDimensions(100,200,400,250);
	//dialogText.setDimensions(300,300,200,50);
	//dialogText.setText("This is a test of the FontEngine system which is super baller \namirite? \n \n-Gankro!!!!");
	//dialogText.showSubText(0,0);
}

function buildActions(){
	sprites.karkat.addAction(new Action("swap","changeChar","karkat"));

	sprites.karclone.addAction(new Action("talk","talk","@CGAngry blahblahblah @CGSpecial hehehe @GGMad whaaaat"));
	sprites.karclone.addAction(new Action("change room","changeRoom","cloneRoom,300,300"));
	sprites.karclone.addAction(new Action("swap","changeChar","karclone"));
//    sprites.karclone.addAction(new Action("T3R3Z1 TH3M3", "newSong", "karclone"));
	
	sprites.karclone2.addAction(new Action("talk","talk","blahblahblah2"));
	sprites.karclone2.addAction(new Action("change room","changeRoom","baseRoom,300,300"));
	sprites.karclone2.addAction(new Action("swap","changeChar","karclone2"));
}

function buildCommands(){
	commands.talk = talkCommand;
	commands.changeRoom = changeRoomCommand;
	commands.changeChar = changeCharCommand;
}

function performAction(action){
	commands[action.command](action.info);
}

function focusCamera(){
	Stage.x = Math.max(0,Math.min(focus.x-Stage.width/2/Stage.scaleX,curRoom.width-Stage.width/Stage.scaleX));
	Stage.y = Math.max(0,Math.min(focus.y-Stage.height/2/Stage.scaleY,curRoom.height-Stage.height/Stage.scaleY));
}

function changeRoom(newRoom,newX,newY){
	destRoom = newRoom;
	destX = newX;
	destY = newY;
}

function handleRoomChange(){
	if(destRoom){
		if(Stage.fade<1){
			Stage.fade=Math.min(1,Stage.fade+Stage.fadeRate);
		}else {
			char.x = destX;
			char.y = destY;
			moveSprite(char,curRoom,destRoom);
			curRoom = destRoom;
		    curRoom.initialize();
			destRoom = null;
		}
	}else if(Stage.fade>0.01){
		Stage.fade=Math.max(0.01,Stage.fade-Stage.fadeRate);
		//apparently alpha 0 is buggy?
	}
}

function handleTextUpdates(){
	if(dialoger.talking){
		dialoger.dialog.showSubText(null,dialoger.dialog.end+1);
	}else if(chooser.choosing){
		for(var i=0;i<chooser.dialogs.length;i++){
			var curDialog = chooser.dialogs[i];
			curDialog.showSubText(null,curDialog.end+1);
			if(i==chooser.choice){
				curDialog.color = "#aaaaaa";	
			}else{
				curDialog.color = "#000000";
			}
		}
	}
}

function moveSprite(sprite,oldRoom,newRoom){
	oldRoom.removeSprite(sprite);
	newRoom.addSprite(sprite);
}

function beginChoosing(){
	char.idle();
	chooser.choosing = true;
	chooser.choice = 0;
	chooser.dialogs = new Array();
	for(var i=0;i<chooser.choices.length;i++){
		var curEngine = new FontEngine("> "+chooser.choices[i].name);
		curEngine.showSubText(0,1);
		curEngine.setDimensions(char.x,char.y+i*curEngine.lineHeight);
		chooser.dialogs.push(curEngine);
	}
}

function drawChoices(){
	stage.save();
	if(chooser.choosing){
		var x,y,width=0,height=0,i;
		x = chooser.dialogs[0].x;
		y = chooser.dialogs[0].y;
		for(i=0;i<chooser.dialogs.length;i++){
			width = Math.max(width,chooser.dialogs[i].lines[0].length*chooser.dialogs[i].charWidth);
		}
		height = chooser.dialogs[0].lineHeight*chooser.dialogs.length;
		stage.fillStyle = "#ffffff";
		stage.fillRect(x,y,width,height);
		for(i=0;i<chooser.dialogs.length;i++){
			chooser.dialogs[i].draw();
		}
	}
	stage.restore();
}

function drawDialog(){
	if(dialoger.talking){
		stage.fillStyle = "#ffffff";
		stage.fillRect(dialoger.dialog.x,dialoger.dialog.y,dialoger.dialog.width,dialoger.dialog.height);
		dialoger.dialog.draw();
	}
}

function setCurRoomOf(sprite){
	if(!curRoom.contains(sprite)){
		for(var room in rooms){
			if(rooms[room].contains(sprite)){
				changeRoom(rooms[room],char.x,char.y);
				return;
			}
		}
	}
}

function changeBGM(newSong) {
    if(bgm) {
	bgm.pause();
	bgm.currentTime = 0;
    }
    bgm = newSong;
    bgm.play();
}
