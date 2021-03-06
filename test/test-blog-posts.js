const chai = require('chai');
const chaiHttp = require('chai-http');
const faker = require('faker');
const mongoose = require('mongoose');

const {BlogPost, Users} = require('../models');
const {closeServer, runServer, app} = require('../server');
const {TEST_DATABASE_URL} = require('../config');

const should = chai.should();
chai.use(chaiHttp);

const genUser = ()=>{
  const user = {
    username: faker.address.country(),
    firstName: faker.name.firstName(),
    lastName: faker.name.lastName(),
    password: '$2a$10$3dbXDMQ1eBWoG/5NqEHspud.V9ktIeZPEHhJHf3NsRCru2K3XIsHO',
  }; 
  return user; 
};

function tearDownDb() {
  return new Promise((resolve, reject) => {
    console.warn('Deleting database');
    mongoose.connection.dropDatabase()
      .then(result => resolve(result))
      .catch(err => reject(err));
  });
}

async function seedData() {
  await Users.create(genUser());
  console.info('seeding blog post data');
  const seedPosts = [];
  for (let i = 1; i <= 2; i++) {
    let res = await Users.findOne();
      seedPosts.push({
        author: {
          firstName: res.firstName,
          lastName: res.lastName
        },
        title: faker.lorem.sentence(),
        content: faker.lorem.text()
      });
  }
  for(let i=1; i <= 7; i++){
    seedPosts.push({
      author: {
        firstName: faker.name.firstName(),
        lastName: faker.name.lastName()
      },
      title: faker.lorem.sentence(),
      content: faker.lorem.text()
    });
  }
  // Users.insertMany(seedUsers);
  await BlogPost.insertMany(seedPosts);
}

describe('blog posts API resource', function() {

  before(function() {
    return runServer(TEST_DATABASE_URL);
  });

  beforeEach(function() {
    return seedData();
  });

  afterEach(function() {
    // tear down database so we ensure no state from this test
    // effects any coming after.
    return tearDownDb();
  });

  after(function() {
    return closeServer();
  });

  // note the use of nested `describe` blocks.
  // this allows us to make clearer, more discrete tests that focus
  // on proving something small
  describe('GET endpoint', function() {

    it('should return all existing posts', function() {
      // strategy:
      //    1. get back all posts returned by by GET request to `/posts`
      //    2. prove res has right status, data type
      //    3. prove the number of posts we got back is equal to number
      //       in db.
      let res;

      return chai.request(app)
        .get('/posts')
        .then(_res => {
          res = _res;
          res.should.have.status(200);
          // otherwise our db seeding didn't work
          res.body.should.have.length.of.at.least(1);

          return BlogPost.count();
        })
        .then(count => {
          // the number of returned posts should be same
          // as number of posts in DB
          res.body.should.have.length.of(count);
        });
    });

    it('should return posts with right fields', function() {
      // Strategy: Get back all posts, and ensure they have expected keys

      let resPost;
      return chai.request(app)
        .get('/posts')
        .then(function(res) {

          res.should.have.status(200);
          res.should.be.json;
          res.body.should.be.a('array');
          res.body.should.have.length.of.at.least(1);

          res.body.forEach(function(post) {
            post.should.be.a('object');
            post.should.include.keys('id', 'title', 'content', 'author', 'created');
          });
          // just check one of the posts that its values match with those in db
          // and we'll assume it's true for rest
          resPost = res.body[0];
          return BlogPost.findById(resPost.id).exec();
        })
        .then(post => {
          resPost.title.should.equal(post.title);
          resPost.content.should.equal(post.content);
          resPost.author.should.equal(post.authorName);
        });
    });
  });

  describe('POST endpoint', function() {
    // strategy: make a POST request with data,
    // then prove that the post we get back has
    // right keys, and that `id` is there (which means
    // the data was inserted into db)
    it('should add a new blog post', async function() {

      const newPost = {
        title: faker.lorem.sentence(),
        content: faker.lorem.text()
      };
      let userBody;
      await Users.findOne().then(function (res){ userBody = res;}); 
      return chai.request(app)
        .post('/posts')
        .auth(userBody.username, 'password')
        .send(newPost)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'title', 'content', 'author', 'created');
          res.body.title.should.equal(newPost.title);
          // cause Mongo should have created id on insertion
          res.body.id.should.not.be.null;
          res.body.author.should.equal(
            `${userBody.firstName} ${userBody.lastName}`);
          res.body.content.should.equal(newPost.content);
          return BlogPost.findById(res.body.id).exec();
        })
        .then(function(post) {
          post.title.should.equal(newPost.title);
          post.content.should.equal(newPost.content);
          post.author.firstName.should.equal(`${userBody.firstName}`);
          post.author.lastName.should.equal(`${userBody.lastName}`);
        });
    });
    
    it('should NOT add a new blog post with invalid creditials', async function() {
      const newPost = {
        title: faker.lorem.sentence(),
        content: faker.lorem.text()
      };
      
      let userBody;
      await Users.findOne().then(function (res){ userBody = res;}); 
      return chai.request(app)
        .post('/posts')
        .auth('asdfsadf', 'asdfasdf')
        .send(newPost)
        .then(function(res) {
          res.should.not.have.status(201);
        }).catch(err => {
          return err.should.have.status(401);
        });
    });
    
    it('should add a new user', function() {
      const newUser = genUser();
      
      return chai.request(app)
        .post('/users')
        .send(newUser)
        .then(function(res) {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.should.include.keys(
            'id', 'username', 'firstName', 'lastName');
          res.body.username.should.equal(newUser.username);
          return Users.findById(res.body.id).exec();
        })
        .then(function(queriedUser) {
          queriedUser.username.should.equal(newUser.username);
          queriedUser.firstName.should.equal(newUser.firstName);
          queriedUser.lastName.should.equal(newUser.lastName);
        })
        });
  });

  describe('PUT endpoint', function() {

    // strategy:
    //  1. Get an existing post from db
    //  2. Make a PUT request to update that post
    //  3. Prove post returned by request contains data we sent
    //  4. Prove post in db is correctly updated
    it('should update fields you send over', function() {
      const updateData = {
        title: 'cats cats cats',
        content: 'dogs dogs dogs',
      };
      let userBody;
      Users.findOne().then(res =>{ userBody = res; 
    }); 

      return BlogPost
        .findOne()
        .exec()
        .then(post => {
          updateData.id = post.id;

          return chai.request(app)
            .put(`/posts/${post.id}`)
            .auth(userBody.username, 'password')
            .send(updateData);
        })
        .then(res => {
          res.should.have.status(201);
          res.should.be.json;
          res.body.should.be.a('object');
          res.body.title.should.equal(updateData.title);
          res.body.content.should.equal(updateData.content);

          return BlogPost.findById(res.body.id).exec();
        })
        .then(post => {
          post.title.should.equal(updateData.title);
          post.content.should.equal(updateData.content);
          post.author.firstName.should.equal(userBody.firstName);
          post.author.lastName.should.equal(userBody.lastName);
        });
    });
    
    it('should update a blog post with invalid creditials', async function() {
      const newPost = {
        title: faker.lorem.sentence(),
        content: faker.lorem.text()
      };
      
      let userBody;
      await Users.findOne().then(function (res){ userBody = res;}); 
      return chai.request(app)
        .put(`/posts/${userBody._id}`)
        .auth('asdfsadf', 'asdfasdf')
        .send(newPost)
        .then(function(res) {
          res.status.should.not.be(201)
        }).catch(err => {
          return err.should.have.status(401);
        });
    });
  });

  describe('DELETE endpoint', function() {
    // strategy:
    //  1. get a post
    //  2. make a DELETE request for that post's id
    //  3. assert that response has right status code
    //  4. prove that post with the id doesn't exist in db anymore
    it('should delete a post by id', async function() {

      let post;
      let userBody;
      await Users.findOne().then(res=> userBody = res);
      return BlogPost
        .findOne()
        .exec()
        .then(_post => {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`).auth(userBody.username, 'password');
        })
        .then(res => {
          res.should.have.status(204);
          return BlogPost.findById(post.id);
        })
        .then(_post => {
          // when a variable's value is null, chaining `should`
          // doesn't work. so `_post.should.be.null` would raise
          // an error. `should.be.null(_post)` is how we can
          // make assertions about a null value.
          should.not.exist(_post);
        });
    });
    
    it('should update a blog post with invalid creditials', async function() {
      let post;
      let userBody;
      await Users.findOne().then(res=> userBody = res);
      return BlogPost
        .findOne()
        .exec()
        .then(_post => {
          post = _post;
          return chai.request(app).delete(`/posts/${post.id}`).auth('laksdfj', 'asdfasdf');
        })
        .then(res => {
          res.should.not.have.status(204);
        })
        .catch(err => {
          err.should.have.status(401);
        });
    });
  });
});