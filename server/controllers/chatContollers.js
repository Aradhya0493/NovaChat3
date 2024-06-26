const asyncHandler = require("express-async-handler");
const chat = require("../models/chatModel");
const userModel = require("../models/userModel");

const Message = require("../models/MessageModel");
 const clearChat = asyncHandler(async (req, res) => {
   const { chatId } = req.params;
   console.log(chatId);

  try {

    // Delete all messages associated with the chat
    await Message.deleteMany({ chat: chatId });

    // Optionally, update the chat document to reflect that it's now empty

    res.status(200).json({ message: 'Chat cleared successfully' });   } catch (error) {
    res.status(500).json({ message: 'Failed to clear chat', error: error.message });
  }
 });

//accessChat api handler(one on one chat between user logged in and userid provided)
const accessChat = asyncHandler(async (req,res)=>{
    const {userId} = req.body;
    if(!userId){
        console.log("UserId param not sent with request");
        return res.sendStatus(400);
    }
    //if chat exits with user
    var isChat = await chat.find({
        isGroupChat: false,
        $and: [
            { users: { $elemMatch: { $eq: req.user._id} } },
            { users: { $elemMatch: { $eq: userId} } },
        ],
    }).populate("users", "-password").populate("latestMessage");

      isChat = await userModel.populate(isChat,{
        path: 'latestMessage.sender',
        select: "username profile email ",
      });

      if(isChat.length > 0){
        res.send(isChat[0]);
      }else {
        //creating a new chat
        var chatData = {
            chatName: "sender",
            isGroupChat: false,
            users: [req.user._id,userId],
        };
        try {
            const createdChat = await chat.create(chatData);
            const FullChat = await chat.findOne({_id: createdChat._id}).populate(
                "users", 
                "-password"
            );
            res.status(200).send(FullChat);
        } catch (error){
            res.status(400);
            throw new Error(error.message);
        }
      }
});

//fetchChats api handler(fetch chat for that particular user is part of )
const fetchChats = asyncHandler(async (req,res)=>{
    try {
        chat.find({users: {$elemMatch: {$eq: req.user._id} } }).populate("users","-password").populate("groupAdmin","-password").populate("latestMessage").sort({updatedAt: -1}).then(async (results)=> {
            results = await userModel.populate(results,{
                path: "latestMessage.sender",
                select: "username profile email",
            });
            res.status(200).send(results);
        });
    }catch(error) {
        res.status(400);
        throw new Error(error.message);
    }
});

//groupchat api handler

const  createGroupChat = asyncHandler(async (req,res)=> {
   if(!req.body.users || !req.body.name){
    return res.status(400).send({message: "please Fill all the fields"});
   }
   var users = JSON.parse(req.body.users);
   if(users.length<2){
    return res.status(400).send("More Than 2 users are required to form a group");
   }
    users.push(req.user);
    try {
        const groupChat = await chat.create({
            chatName : req.body.name,
            users: users,
            isGroupChat: true,
            groupAdmin: req.user,

        });
        const fullGroupChat = await chat.findOne({_id: groupChat._id})
        .populate("users","-password")
        .populate("groupAdmin","-password");
        res.status(200).json(fullGroupChat);

    } catch (error) {
        res.status(400);
        throw new Error(error.message);
    }
});

//rename api handler
const renameGroup = asyncHandler(async (req,res)=> {
    const {chatId,chatName} = req.body;
    const updatedChat = await chat.findByIdAndUpdate(
        chatId,
        {
           chatName: chatName,
        },
        {
            new: true,
        }
    )
    .populate("users" , "-password")
    .populate("groupAdmin", "-password");

    if(!updatedChat){
        res.status(404);
        throw new Error("Chat Not Found");
    }else {
        res.json(updatedChat);
    }
});

//api for adding to group
const removeFromGroup = asyncHandler(async (req, res) => {
    const { chatId, userId } = req.body;
  
    // check if the requester is admin
  
    const removed = await chat.findByIdAndUpdate(
      chatId,
      {
        $pull: { users: userId },
      },
      {
        new: true,
      }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");
  
    if (!removed) {
      res.status(404);
      throw new Error("Chat Not Found");
    } else {
      res.json(removed);
    }
  });
  
  // @desc    Add user to Group / Leave
  // @route   PUT /api/chat/groupadd
  // @access  Protected
 const addToGroup = asyncHandler(async (req, res) => {
    const { chatId, userId } = req.body;
  
    // check if the requester is admin
  
    const added = await chat.findByIdAndUpdate(
      chatId,
      {
        $push: { users: userId },
      },
      {
        new: true,
      }
    )
      .populate("users", "-password")
      .populate("groupAdmin", "-password");
  
    if (!added) {
      res.status(404);
      throw new Error("Chat Not Found");
    } else {
      res.json(added);
    }
  });
  


module.exports = {accessChat,fetchChats,createGroupChat,renameGroup,removeFromGroup,addToGroup,clearChat};