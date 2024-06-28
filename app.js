const express=require('express');
const app=express();
const userModel=require('./models/user');
const cookieParser = require('cookie-parser');
const bcrypt=require('bcrypt');
const postModel=require('./models/post');
const jwt=require('jsonwebtoken');
const path=require('path');
const upload=require('./config/multerconfig');


app.set("view engine","ejs");
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cookieParser());//reading cookie
app.use(express.static(path.join(__dirname,"public")));





app.get('/',function(req,res){
    res.render("index");
});

app.get('/recent-posts', async function(req, res) {
    try {
        let users = await userModel.find().populate({ path: 'posts', populate: { path: 'user' } });
        let allPosts = [];
        users.forEach(user => {
            allPosts.push(...user.posts);
        });

        allPosts.sort((a, b) => b.date - a.date);

        let loggedInUser = req.user;
        res.render("recent-posts", { posts: allPosts, user: loggedInUser });
    } catch (err) {
        console.error(err);
        res.status(500).send("Server Error");
    }
});



app.get('/login',function(req,res){
    res.render("login");

});


app.get('/profile',isLoggedIn,async function(req,res){
    let user=await userModel.findOne({email:req.user.email}).populate("posts");
    res.render("profile",{user});

});

app.get('/like/:id',isLoggedIn,async function(req,res){
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");

        if (!post) {
            return res.status(404).send("Post not found");
        }

        const userIdIndex = post.likes.indexOf(req.user.userid);

        if (userIdIndex === -1) {
            post.likes.push(req.user.userid);
        } else {
            post.likes.splice(userIdIndex, 1);
        }

        await post.save();
        res.redirect("/profile");

});

app.get('/edit/:id',isLoggedIn,async function(req,res){
    let post = await postModel.findOne({ _id: req.params.id }).populate("user");
    res.render("edit",{post});
});

app.post('/update/:id',isLoggedIn,async function(req,res){ //changing/modify->post
    let post = await postModel.findOneAndUpdate({ _id: req.params.id },{content:req.body.content});
    res.redirect("/profile");
});


app.post('/post',isLoggedIn,async function(req,res){//post tbhi hoga jb aap log in honge->isloggedin se 
    let user=await userModel.findOne({email:req.user.email});
    let {content}=req.body;

    let post =await postModel.create({
        user:user._id,
        content,

    });

    user.posts.push(post._id);
    await user.save();//changes by hand ->save
    res.redirect("/profile");

});

app.post('/register',async function(req,res){
    let {email,password,username,name,age} =req.body;
    let user= await userModel.findOne({email});
    if(user)  return res.status(500).send("User already registered!");

    bcrypt.genSalt(10,(err,salt)=>{
        bcrypt.hash(password,salt,async (err,hash)=>{
            //hash->password
            let user=await userModel.create({
                username,
                email,
                age,
                name,
                password:hash
            })

            let token=jwt.sign({email:email,userid:user._id},"secretkey");
            res.cookie("token",token);
            //res.send("registered succesfully!");
            res.redirect("/login");
        })
    })



});

app.post('/login',async function(req,res){
    let {email,password} =req.body;
    let user= await userModel.findOne({email});
    if(!user)  return res.status(500).send("Something went wrong!"); //if no user is there 

    bcrypt.compare(password, user.password, function(err, result) {
        if (err) {
            return res.status(500).send("Error while comparing passwords");
        }
        if (result) {
            let token=jwt.sign({email:email,userid:user._id},"secretkey");
            res.cookie("token",token);
            return res.status(200).redirect("/profile");

        } else {
            return res.status(401).send("Invalid password");
        }
    });

});

app.get('/logout',function(req,res){
    res.cookie("token","");
    res.redirect("/login");

});

function isLoggedIn(req,res,next){//middleware->protected route create
    if(req.cookies.token === "") res.redirect("/login");
    else{
        let data=jwt.verify(req.cookies.token,"secretkey");
        req.user=data;
        next();
    }
}





app.get("/profile/upload",(req,res)=>{
    res.render("profileupload");
})

app.post("/upload",isLoggedIn,upload.single('image'),async (req,res)=>{
    let user=await userModel.findOne({email:req.user.email});
    user.profilepic=req.file.filename;
    await user.save(); // by hand 
    res.redirect("/profile");
})



app.listen(3000);
