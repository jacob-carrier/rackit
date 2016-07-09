var express = require('express');
var app = express();
var mongoose = require('mongoose');

var fs = require('fs');

var sha1 = require('sha1');

mongoose.connect('mongodb://localhost/rackit');

app.engine('html', require('ejs').__express);

app.set('views', __dirname + '/views');
app.set('view engine', 'html');
app.use(express.bodyParser());

var Schema = mongoose.Schema;

var ArticleSchema = new Schema({
	user: Schema.Types.ObjectId,
	thumbnail: String,
	img: String,
	tags: [String]
});

ArticleSchema.options.toJSON = {transform: function(doc, ret, options){
	delete ret._id;
	delete ret.user;
	delete ret.__v;
}}

var OutfitsSchema = new Schema({
	user: Schema.Types.ObjectId,
	title: {type: String, unique: true},
	articles: [{ article: Schema.Types.ObjectId, slot: Number}],
	privacy: {type:String, enum: ["private", "public", "world"]},
	tags: [String]
});

var ClosetSchema = new Schema({
	articles: Schema.Types.ObjectId
});

var TravelBagSchema = new Schema({
	title: {type: String, unique: true},
	articles: Schema.Types.ObjectId
});

var UserSchema = new Schema({
	username: {type: String, unique: true},
	password: String,
	subscribed: Boolean,
	registered_on: {type: Date, default: Date.now},
	followers: [Schema.Types.ObjectId]
});

UserSchema.options.toJSON = {transform: function(doc, ret, options){
	delete ret.__v;
}}

var ClothingArticles = mongoose.model('ClothingArticle', ArticleSchema);
var Outfits = mongoose.model('Outfits', OutfitsSchema);
var Closet = mongoose.model('Closet', ClosetSchema);
var TravelBag = mongoose.model('TravelBag', TravelBagSchema);
var Users = mongoose.model('User', UserSchema);

app.get('/api', function(req, res){
	res.render('index', {
		title: "API Page",
		header: "New Header"				
	});
});

app.get('/api/registration_form', function(req, res){
	res.render('signup');
});

//API REGISTER

app.post('/api/register', function(req, res){
	var hashPass = sha1(req.body["password"]);
	var user = new Users({
		username: req.body["username"],
		password: hashPass,
		subscribed: false
	});

	user.save(function(err){
		if(!err){
			res.send(201, {success: 'Your account was created successfully'});
			//return console.log("User has been saved!");
		}else{
			//return console.log(err)
			res.send(500, {error: 'You could not be registered'})
		}
	});

	//Rendering of the page for testing
	/*
	res.render('logged_in', {
		username: user.username			
	});
*/
});

//Find a user based on their id.

app.get('/api/user/:id([A-za-z0-9]{24})', function(req, res){
	console.log(req.params.id);
	Users.find({_id: req.params.id}, function(err, user){
		if(!err){
			res.send(user);
		}else{
			console.log(err);
		}
	});
});

//Get a list of followers based on the user's id
//This one could potentially be slow based on the growth of amount of users.

app.get('/api/followers/:id([A-za-z0-9]{24})', function(req, res){
	console.log(req.params.id);
	Users.find({_id: req.params.id}, function(err, user){
		if(!err){
			console.log("Found the user, now searching the followers");
			//res.send(user);
			console.log(user[0]["followers"]);
			Users.find({_id: {"$in": user[0]["followers"]}}, function(err, users){
				if(!err){
					res.send(users);
				}else{
					console.log(err);
				}
			});
		}else{
			console.log(err);
		}
	});
});

app.get('/api/login_form', function(req, res){
	res.render('login');
});

//API LOGIN

app.post('/api/login', function(req, res){
	//res.send(req.body["username"]);
	//console.log(JSON.stringify(req.body["username"]));
	//console.log(req.body["password"]);
	var hashPass = sha1(req.body["password"]);
	Users.find({$and: [{username: req.body["username"]}, {password: hashPass}]}, function(err, user){
		if(!err){
			if(user.length > 0){
				// Web page debugging/testing
				//res.render('logged_in', {username: user[0].username});

				//JSON Object return
				res.send(200, {data: user});
			}else{
				res.send(500, {error: 'User not found'})
			}
			//console.log(user);
		}else{
			console.log(err);
		}
		
	});
});

app.get('/api/closet/:id([A-za-z0-9]{24})', function(req, res){
	Users.find({_id: req.params.id}, function(err, user){
		ClothingArticles.find({user: user[0]["_id"]}, function(err, articles){
			if(!err){
				if(articles.length > 0){
					res.send(200, {data: articles});
				}else{
					res.send(500, {error: 'No articles found'});
				}
			}
		});
	});
});

//User uploads image of clothing article from phone to server
//http://howtonode.org/really-simple-file-uploads
app.get('/api/articles', function(req, res){
	res.render('articles');
});

app.post('/api/articles/upload', function(req, res){
	//console.log(req.body);
	
	var filename = req.body["filename"] + ".jpg";

	var newPath = __dirname + "/uploads/" + req.body["_id"] + "/";

	fs.mkdir(newPath, function(error){
		if(error){
			console.log(error);
		}
	});

	var base64String = req.body["imageString"];
	//var raw = base64String.replace(/ /g, '+');

	var stringFromBase64 = new Buffer(base64String, "base64");

	fs.writeFile(newPath + filename, stringFromBase64, function(err){
		if(err){
			console.log("Couldn't write image to disk! \n" + err);
		}else{
			
			var article = new ClothingArticles({
				user: req.body["_id"],
				img: filename,
				thumbnail: "",
				tags: []
			});
			
			article.save(function(err){
				if(err){
					console.log("Error saving to DB! \n" + err);
				}else{
					res.send(200, {});
				}
			});
			
			res.send(200, {});
		}
	});
});

/*
app.post('/api/articles/upload', function(req, res){
	console.log(req.files);
	
	fs.readFile(req.files.image.path, function(err, data){
		var newPath = __dirname + "/uploads/" + req.body["_id"] + "/";

		fs.mkdir(newPath, function(error){
			if(err){
				console.log(error);
			}
		});
		var base64String = new Buffer(data, "binary").toString('base64');
		var article = new ClothingArticles({
			user: req.body["_id"],
			img: base64String,
			thumbnail: "",
			tags: []
		});

		article.save(function(err){
			if(err){
				console.log(err);
			}else{
				fs.writeFile(newPath + req.body["filename"], base64String, function(err){
					if(err){
						console.log(err);
					}else{
						res.send(200, {});
					}
				});
			}
		});
	});
});
*/
app.get('/api/articles/image/:id([A-za-z0-9]{24})/:filename([A-za-z0-9]+.?[a-z]{3})', function(req, res){
	console.log(req.params);
	var path = __dirname + "/uploads/" + req.params.id + "/" + req.params.filename;
	fs.readFile(path, "binary", function(error, file){
		if(error){
			console.log(error);
			res.send(500, {error: "Image not found.", imgData: 0});
		}else{
			//res.writeHead(200, {"Content-Type": "image/jpg"});
			//res.write(file, "binary");
			var base64String = new Buffer(file, "binary").toString('base64');
			//console.log(base64String);
			res.send(200, {imgData: base64String});
		}
	});
});

//User looks at closet, therefore requests images to be displayed on their phone
app.listen(3000);