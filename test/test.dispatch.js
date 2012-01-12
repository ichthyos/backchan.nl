var should = require('should'),
    server = require('../lib/server.js'),
    client = require('../static/js/client.js'),
    model = require('../lib/server-model.js'),
    dispatch = require('../lib/dispatch.js');

var curServer, curClient;
var clients;

describe('dispatcher', function() {
    describe('BaseDispatch', function() {
                before(function(done) {
                    curServer = new server.BackchannlServer();
                    curServer.bind("started", done);
                    curServer.start("localhost", 8181);
                });
        
                beforeEach(function(done) {
                    curServer.reset({"test-event":true, "dispatcher":"base"});
        
                    clients = [];
        
                    clients.push(new client.ConnectionManager());
                    clients.push(new client.ConnectionManager());
        
                    clients[0].bind("state.JOINED", function() {
                        clients[1].connect("localhost", 8181, {
                            "auto-identify":true,
                            "auto-join":true
                        });                    
                    });
        
                    clients[1].bind("state.JOINED", function() {
                        done();
                    })
        
                    clients[0].connect("localhost", 8181, {
                        "auto-identify":true,
                        "auto-join":true
                    });
                });
        
                after(function(done) {
                    curServer.bind("stopped", done);
                    curServer.stop();
                });
        
                it('should receive notices about new posts', function(done){
                    var dispatcher = curServer.events.get(0).get("dispatcher");
        
                    dispatcher.should.exist;
        
                    dispatcher.bind("post.new", function(post) {
        
                       post.should.exist;
                       post.get("text").should.equal("hello world");
        
                       done();
                    });
        
                    clients[0].post("hello world");
                });
        
                it('should receive notices about post votes', function(done){
                    var dispatcher = curServer.events.get(0).get("dispatcher");
        
                    dispatcher.should.exist;
        
                    dispatcher.bind("post.new", function(post) {
                        // now vote with other client
                        clients[1].vote(post.id);
                    });
        
                    dispatcher.bind("post.vote", function(post, voter) {
                        post.should.exist;
                        voter.should.exist;

                        // we expect to get two votes, one when the 
                        // post is created (from its creator) and then
                        // one followup vote from clients[1].
                        if(post.votes()==1) {
                            voter.id.should.equal(clients[0].user.id);
                        } else {
                            post.get("fromId").should.not.equal(voter.id);
                            voter.id.should.equal(clients[1].user.id);
                            done();
                        }
                    });
        
                    clients[0].post("hello world");
                });
        
                it('should handle promotes properly', function(done){
        
                    // basically the goal here is just to call promote and see
                    // if the second client gets a post event and if the first
                    // client gets a promoted message
                    var dispatcher = curServer.events.get(0).get("dispatcher");
                    var thePost;
        
                    dispatcher.should.exist;
        
                    dispatcher.bind("post.new", function(post) {
                        // now promote the post.
                        dispatcher.promotePost(post);
                        thePost = post;
        
                    });
        
                    clients[1].bind("message.post", function(post) {
                        // did the second client get added to the post properly?
                        thePost.isPromoted().should.be.true;
        
                        post.isPromoted().should.be.true;
        
                        post.get("text").should.equal("hello world");
                        post.votes().should.equal(0);
        
                        done();
                    })
        
                    clients[0].post("hello world");
                });
            });
            
    describe('BroadcastDispatch', function() {
        before(function(done) {
            curServer = new server.BackchannlServer({"test-event":true,
                "dispatcher":"broadcast"
            });
            curServer.bind("started", done);
            curServer.start("localhost", 8181);
        });

        beforeEach(function(done) {
            curServer.reset({"test-event":true,
                "dispatcher":"broadcast"
            });

            clients = [];

            clients.push(new client.ConnectionManager());
            clients.push(new client.ConnectionManager());
            clients.push(new client.ConnectionManager());
            
            clients[0].bind("state.JOINED", function() {
                clients[1].connect("localhost", 8181, {
                    "auto-identify":true,
                    "auto-join":true
                });                    
            });

            clients[1].bind("state.JOINED", function() {
                clients[2].connect("localhost", 8181, {
                    "auto-identify":true,
                    "auto-join":true
                });                    
            });


            clients[2].bind("state.JOINED", function() {
                done();
            })

            clients[0].connect("localhost", 8181, {
                "auto-identify":true,
                "auto-join":true
            });
        });

        after(function(done) {
            curServer.bind("stopped", done);
            curServer.stop();
        });
        
        it('should broadcast every new post to all users', function(done){
            clients[1].bind("message.post", function(post) {
                post.should.exist;
                
                post.get("text").should.equal("testing broadcast dispatch");
                post.isPromoted().should.be.true;
                
                done();
            });
            
            clients[0].post("testing broadcast dispatch");
        });
    });
    
    describe('SpreadingDispatch, no promotion', function() {
        before(function(done) {
            curServer = new server.BackchannlServer();
            curServer.bind("started", done);
            curServer.start("localhost", 8181);
        });

        beforeEach(function(done) {
            curServer.reset({"test-event":true,
                "dispatcher":"spread",
                "dispatcher-options":{"starting-spread":1, "on-vote-spread":1,
                    "promotion-window":0}
            });

            clients = [];

            clients.push(new client.ConnectionManager());
            clients.push(new client.ConnectionManager());
            clients.push(new client.ConnectionManager());
            
            clients[0].bind("state.JOINED", function() {
                clients[1].connect("localhost", 8181, {
                    "auto-identify":true,
                    "auto-join":true
                });                    
            });

            clients[1].bind("state.JOINED", function() {
                clients[2].connect("localhost", 8181, {
                    "auto-identify":true,
                    "auto-join":true
                });                    
            });

            clients[2].bind("state.JOINED", function() {
                done();
            })

            clients[0].connect("localhost", 8181, {
                "auto-identify":true,
                "auto-join":true
            });
        });

        after(function(done) {
            curServer.bind("stopped", done);
            curServer.stop();
        });
    
        it('should send the message to one other client on post', function(done){
            
            clients[1].bind("message.post", function(post) {
                    done();
            });
            
            clients[2].bind("message.post", function(post) {
                    done();
            });
            
            // TODO is there a nice way to make sure clients[0] doesn't get
            // the post a second time? That should be a check on ServerPost.
            
            clients[0].post("testing spreading dispatcher");
        });
        
        it('should send to another client when it gets a vote',function(done){
            
            var selectedClient;
            var receivedMessage = false;
            clients[1].bind("message.post", function(post) {
                if(receivedMessage) return;
                receivedMessage = true;
                
                clients[2].bind("message.post", function() {
                    done();
                });
                
                clients[1].vote(post.id);
            });
            
            clients[2].bind("message.post", function(post) {
                if(receivedMessage) return;
                receivedMessage = true;
                
                clients[1].bind("message.post", function() {
                    done();
                });
                
                clients[2].vote(post.id);
            });
            
            // TODO is there a nice way to make sure clients[0] doesn't get
            // the post a second time? That should be a check on ServerPost.
            
            clients[0].post("testing spreading dispatcher");
        });
        
        it('should be okay when it tries to spread beyond the last user in an event', function(done) {
            
            // plan here is to vote for something twice (after the initial
            // vote) which will try to spread the post again (because
            // promotion is turned off) which will fail. see what happens!
            
            clients[1].bind("message.post", function(post) {
                clients[1].vote(post.id);
            });
            
            clients[2].bind("message.post", function(post) {
                clients[2].vote(post.id);
            });
            
            clients[0].bind("message.promoted", function(post) {
                post.should.exist;
                post.id.should.equal(0);
                done();
            });
            
            clients[0].post("spreading beyond max limit");
        });
    });
    
    describe('SpreadingDispatch, with promotion', function() {
        before(function(done) {
            curServer = new server.BackchannlServer();
            curServer.bind("started", done);
            curServer.start("localhost", 8181);
        });
        
        beforeEach(function(done) {
            curServer.reset({"test-event":true,
                "dispatcher":"spread",
                "dispatcher-options":{"starting-spread":1, "on-vote-spread":1,
                    "promotion-window":2}
            });
            
            clients = [];
            
            clients.push(new client.ConnectionManager());
            clients.push(new client.ConnectionManager());
            clients.push(new client.ConnectionManager());
            
            clients[0].bind("state.JOINED", function() {
                clients[1].connect("localhost", 8181, {
                    "auto-identify":true,
                    "auto-join":true
                });                    
            });
    
            clients[1].bind("state.JOINED", function() {
                clients[2].connect("localhost", 8181, {
                    "auto-identify":true,
                    "auto-join":true
                });                    
            });
    
            clients[2].bind("state.JOINED", function() {
                done();
            })
    
            clients[0].connect("localhost", 8181, {
                "auto-identify":true,
                "auto-join":true
            });
        });
    
        after(function(done) {
            curServer.bind("stopped", done);
            curServer.stop();
        });
    
        it('should promote the first 3 unvoted posts',function(done){
            var postCount = 0;
            clients[1].bind("message.post", function(post) {
                if(postCount==0) {
                    post.should.exist;
                    post.get("text").should.equal("first post");
                    
                    postCount++;
                    clients[0].post("second post");
                } else if(postCount==1) {
                    post.should.exist;
                    post.get("text").should.equal("second post");
                    postCount++;
                    clients[0].post("third post");
                } else {
                    post.should.exist;
                    post.get("text").should.equal("third post");
                    done();
                }
            });
            
            clients[0].post("first post");
        });
        
        it('should trigger promotion events in the client', function(done){
            clients[0].bind("message.promoted", function(post) {
                post.id.should.equal(0);
                done();
            });
            
            clients[0].post("hello world");
        });
        
        it('should not publish a post if original posts have more votes', function(done){
            
            var voteCount = 0;
            clients[2].bind("message.vote-ok", function() {
                voteCount++;
                
                if(voteCount==2) {
                    clients[0].bind("message.promoted", function(post) {
                        should.fail("post should not immediately be promoted");
                    });
                    
                    clients[1].bind("message.post", function(post) {
                        post.id.should.equal(2);
                        done();
                    });

                    clients[2].bind("message.post", function(post) {
                        post.id.should.equal(2);
                        done();
                    });
                    
                    clients[0].post("third post");
                }
            });
            
            clients[0].bind("message.post", function(post) {
               if(post.id==0) {
                   clients[1].vote(0);
                   clients[2].vote(0);
               } else if(post.id==1) {
                   clients[1].vote(1);
                   clients[2].vote(1);
               }
            });
            
            // these will be insta-promoted.
            clients[0].post("first post");
            clients[0].post("second post");
        });
        
        it('should send already-promoted posts to clients who connect late', function(done){

            var postCount=0;
            clients[0].bind("message.promoted", function(post) {
                postCount++;
                
                if(postCount==2) {
                    // log in the new user.
                    var newClient = new client.ConnectionManager();
                    var newClientPostCount=0;
                    newClient.bind("message.post", function(post) {
                        newClientPostCount++;
                        
                        post.should.exist;
                        post.isPromoted().should.be.true;
                        
                        if(newClientPostCount==2) {
                            done();
                        }
                    });
                    
                    newClient.connect("localhost", 8181, {
                        "auto-identify":true,
                        "auto-join":true
                    });
                }
            });
            
            clients[0].post("first post");
            clients[0].post("second post");
        });
    
    });
    
});