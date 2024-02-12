const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

//dotenv
require("dotenv").config();

//middleware
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(cookieParser());

//custom middleware
const verifyToken = async (req, res, next) => {
  //token get from cookies
  const token = req.cookies?.token;
  //console.log('token inside middleware: ',token);

  if (!token) {
    return res.status(401).send({ message: "Unauthorised Access" });
  }
  jwt.verify(token, process.env.ACCESS_TOKEN, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorised Access" });
    }

    req.decodedUser = decoded;
    next();
  });
};

app.get("/", (req, res) => {
  res.send("Welcome to the bistro boss");
});

const uri = `mongodb+srv://${process.env.bistroUser}:${process.env.bistroPass}@cluster0.ljq2tzl.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    // Get the database and collection on which to run the operation
    const database = client.db("bistroDb");
    const menus = database.collection("menus");
    const reviews = database.collection("reviews");
    const carts = database.collection("carts");
    const users = database.collection("users");

    //verify Admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decodedUser?.email
      //console.log(email);
      let query = { email: email };
      
      const user = await users.findOne(query);
     
      const isAdmin = user?.role === 'Admin'
     
      if (!isAdmin) {
        return res.status(403).send({status: "forbidden Access"})
      }

      next()
    };

    //jwt post api endpoint
    app.post("/api/v1/jwt", (req, res) => {
      const user = req.body;
      //console.log(user);
      const token = jwt.sign(user, process.env.ACCESS_TOKEN, {
        expiresIn: "1h",
      });
      //token set into cookies

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
        })
        .send({ staus: true });
    });

    //admin api endpoint
    app.get("/api/v1/admin/:email", verifyToken, async (req, res) => {
      const email = req.params.email;
      //console.log(email,req.decodedUser?.email);
      if (req.decodedUser?.email !== email) {
        return res.status(403).send({ status: "forbidden Access" });
      }

      let query = { email: email };

      //find user by query
      const user = await users.findOne(query);

      // //make a admin false initially
      let isAdmin = false;

      if (user) {
        isAdmin = user?.role === "Admin";
      }

      res.send({ isAdmin: isAdmin });
    });

    //count menus for pagination
    app.get("/api/v1/menusCount", async (req, res) => {
      const result = await menus.estimatedDocumentCount();
      res.send({ count: result });
    });

    //menus api end point
    app.get("/api/v1/menus", async (req, res) => {
      const result = await menus.find().toArray();
      res.send(result);
    });

    //reviews api endpoint
    app.get("/api/v1/reviews", async (req, res) => {
      const result = await reviews.find().toArray();
      res.send(result);
    });

    //users api endpoint
    app.get("/api/v1/users",verifyToken,verifyAdmin,async (req, res) => {
      const result = await users.find().toArray();
      res.send(result);
    });

    //carts api endpoint
    app.get("/api/v1/carts", verifyToken, async (req, res) => {
      const { email } = req.query;

      //console.log(userDecoded);
      if (req.decodedUser?.email !== email) {
        return res.status(403).send({ status: "forbidden Access" });
      }
      let query = {
        email: email,
      };
      const result = await carts.find(query).toArray();
      res.send(result);
    });

    //single cart api endpoint
    app.get("/api/v1/carts/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await carts.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //single user api endpoint
    app.get("/api/v1/users/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await users.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //cart post api endpoint
    app.post("/api/v1/carts",verifyToken, async (req, res) => {
      const cart = req.body;
      const result = await carts.insertOne(cart);
      res.send(result);
    });

    //user post api endpoint
    app.post("/api/v1/users", async (req, res) => {
      const user = req.body;
      const { email } = user;

      const existingUser = await users.findOne({ email: email });
      if (existingUser) {
        res.send({ message: "This user already exists" });
      } else {
        const result = await users.insertOne(user);
        res.send(result);
      }

      //console.log(email);
    });

    //users update api endpoint
    app.patch("/api/v1/users/:email",verifyToken,verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const updates = req.body;
      const filter = { email: email };
      const result = await users.updateOne(filter, { $set: updates });
      res.send(result);
    });

    //cart delete api endpoint
    app.delete("/api/v1/carts/:id",verifyToken, async (req, res) => {
      const id = req.params.id;
      const result = await carts.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    //user delete api endpoint
    app.delete("/api/v1/users/:id",verifyToken,verifyAdmin, async (req, res) => {
      const id = req.params.id;
      console.log(id);
      const result = await users.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    //await client.close();
  }
}
run().catch(console.dir);

//port
app.listen(port, () => console.log(`Server started on ${port}`));
