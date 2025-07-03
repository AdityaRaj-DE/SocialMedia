require('dotenv').config();
const express = require("express");
const app = express();
const { User, connect } = require("./models/user");
const postModel = require("./models/post");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const post = require("./models/post");
const multer = require("multer");
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });
const upload = require("./config/multerconfig");
const path = require("path");

connect();

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public")));
app.use(cookieParser());

app.get("/",isloggedIn, async (req, res) => {
  let posts = await postModel.find({}).populate("user");
  let user = null;
  if (req.cookies.token && req.cookies.token !== "") {
    try {
      let data = jwt.verify(req.cookies.token, "shhhh");
      user = await User.findById(data.userid);
    } catch (e) {
      user = null;
    }
  }
  res.render("index", { posts, user });
});

app.get("/register", async (req, res) => {
  let posts = await postModel.find({}).populate("user");
  let user = null;
  if (req.cookies.token && req.cookies.token !== "") {
    try {
      let data = jwt.verify(req.cookies.token, "shhhh");
      user = await User.findById(data.userid);
    } catch (e) {
      user = null;
    }
  }
  res.render("register", { posts, user });
});

app.get("/profile/upload", isloggedIn, async (req, res) => {
  let user = await User.findOne({ email: req.user.email });
  res.render("profileupload", { user });
});

app.post("/upload", isloggedIn, uploadMemory.single("image"),async (req, res) => {
  let user = await User.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  res.redirect("/profile");
});
app.post("/uploadprofilepic", isloggedIn, upload.single("image"), async (req, res) => {
  let user = await User.findOne({ email: req.user.email });
  user.profilepic = req.file.filename;
  await user.save()
  res.redirect("/profile");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post(
  "/post",
  isloggedIn,
  uploadMemory.single("photo"),
  async (req, res) => {
    let user = await User.findOne({ email: req.user.email });
    let { content } = req.body;
    let photo = req.file
      ? { data: req.file.buffer, contentType: req.file.mimetype }
      : undefined;
    let post = await postModel.create({
      user: user._id,
      content,
      photo,
    });

    user.posts.push(post._id);
    await user.save();
    res.redirect("/profile");
  }
);

app.get("/profile", isloggedIn, async (req, res) => {
  let user = await User
    .findOne({ email: req.user.email })
    .populate("posts");
  res.render("profile", { user });
});

app.get("/like/:id", isloggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  if (post.likes.indexOf(req.user.userid) === -1) {
    post.likes.push(req.user.userid);
  } else {
    post.likes.splice(post.likes.indexOf(req.user.userid), 1);
  }

  await post.save();
  res.redirect("/");
});

app.get("/edit/:id", isloggedIn, async (req, res) => {
  let post = await postModel.findOne({ _id: req.params.id }).populate("user");
  res.render("edit", { post });
});

app.post("/update/:id", isloggedIn, uploadMemory.single("photo"), async (req, res) => {
  const update = { content: req.body.content };
  if (req.file) {
    update.photo = { data: req.file.buffer, contentType: req.file.mimetype };
  }
  await postModel.findOneAndUpdate(
    { _id: req.params.id },
    update
  );
  res.redirect("/profile");
});

app.get("/delete/:id", isloggedIn, async (req, res) => {
  let post = await postModel.findOneAndDelete({ _id: req.params.id });
  res.redirect("/profile");
});

app.post("/register", async (req, res) => {
  let { email, password, username, name, age } = req.body;
  let user = await User.findOne({ email });
  if (user) return res.status(500).send("user already register");

  bcrypt.genSalt(10, (err, salt) => {
    bcrypt.hash(password, salt, async (err, hash) => {
      let user = await User.create({
        username,
        email,
        age,
        name,
        password: hash,
      });
      let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.redirect("/");
    });
  });
});

app.get("/createpost",isloggedIn,async (req,res)=>{
  let user = await User.findOne({ email: req.user.email });
  res.render("createpost",{user});
})

app.post("/login", async (req, res) => {
  let { email, password } = req.body;
  let user = await User.findOne({ email });
  if (!user) return res.status(500).send("something went wrong");

  bcrypt.compare(password, user.password, function (err, result) {
    if (result) {
      let token = jwt.sign({ email: email, userid: user._id }, "shhhh");
      res.cookie("token", token);
      res.status(200).redirect("/");
    } else res.redirect("/login");
  });
});

app.get("/logout", (req, res) => {
  res.cookie("token", "");
  res.redirect("/login");
});

app.get("/post/image/:id", isloggedIn, async (req, res) => {
  const post = await postModel.findById(req.params.id);
  if (!post || !post.photo || !post.photo.data)
    return res.status(404).send("Image not found");
  res.set("Content-Type", post.photo.contentType);
  res.send(post.photo.data);
});

app.post("/editprofile", isloggedIn, async (req, res) => {
  let user = await User.findOne({ email: req.user.email });
  const { name, age, password } = req.body;
  user.name = name;
  user.age = age;
  if (password && password.trim() !== "") {
    const bcrypt = require("bcrypt");
    const hash = await bcrypt.hash(password, 10);
    user.password = hash;
  }
  await user.save();
  res.redirect("/profile");
});

function isloggedIn(req, res, next) {
  if (req.cookies.token === "") res.redirect("/login");
  else {
    let data = jwt.verify(req.cookies.token, "shhhh");
    req.user = data;
    next();
  }
}

app.listen(process.env.PORT);
