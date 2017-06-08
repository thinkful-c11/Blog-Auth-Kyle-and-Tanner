const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');


const blogPostSchema = mongoose.Schema({
  author: {
    firstName: String,
    lastName: String
  },
  title: {type: String, required: true},
  content: {type: String},
  created: {type: Date, default: Date.now}
});

blogPostSchema.virtual('authorName').get(function() {
  return `${this.author.firstName} ${this.author.lastName}`.trim();
});

blogPostSchema.methods.apiRepr = function() {
  return {
    id: this._id,
    author: this.authorName,
    content: this.content,
    title: this.title,
    created: this.created
  };
};

const userSchema = mongoose.Schema({
  username: {type: String, required: true},
  password: {type: String, required: true},
  firstName: {type: String, required: true},
  lastName: {type: String, required: true},
});

userSchema.methods.validatePassword = function(password){
  return bcrypt.compare(password, this.password);
};

userSchema.statics.hashPassword = function(password){
  return bcrypt.hash(password, 10);
};

userSchema.methods.apiRepr = function(){
  return {
    id: this._id,
    username: this.username,
    firstName: this.firstName,
    lastName: this.lastName
  };
};

const BlogPost = mongoose.model('BlogPost', blogPostSchema);
const Users = mongoose.model('Users', userSchema);

module.exports = {BlogPost, Users};
