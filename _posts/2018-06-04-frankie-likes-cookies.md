---
title: "Frankie Likes Cookies"
description: 'Working with Rack middleware: part 04 of the "Sinatra From Scratch" series.'
date: 2018-06-04
---

> This is the final part in a four part series of blog posts that starts [here][1].
{: .aside}

The [previous part][2] of this series of blog posts on Sinatra internals dealt with route parameters. In this final part, we turn to Sinatra’s take on Rack middleware, and briefly discuss those aspects of Frankie that are *not* covered in detail in the series.

The concept of Rack middleware grows naturally out of the concept of a Rack application. As described in [part 01](http://notes.benrodenhaeuser.io/2018/06/01/sinatra-from-scratch/), a Rack application is an object that responds to `call` and returns a three-element array of the appropriate kind. Now nothing prevents a Rack app from sending a `call` message to *another* Rack app, and using the return value of that `call` to determine its own return value. If a number of Rack apps are hooked up in this way, each calling the next, the non-terminal nodes in this configuration are *middleware* (think of the middleware chain as a linked list of Rack apps and you are not far off from the truth). We can then wrap the whole chain in *another* object that responds to `call` (and returns an appropriate array) and provides an entry point to the whole middleware chain.

Sinatra applications are Rack applications, so of course they place nice with Rack middleware. If you have a number of middleware nodes you want to make use of, all you need to do is place corresponding `use` statements close to the top of your Sinatra application file, such as:

```ruby
use MyMiddleware1
use MyMiddleware2
...
```

Sinatra will hook up the nodes in such way that, as a new request comes in, a `MyMiddleware1` instance will be the first node to receive a `call` message, and an instance of `Sinatra::Application` will be the last (the Sinatra app *fronts* the middleware chain), with each but the last node `call`ing the next node in turn. This is simply the way Rack does it, and Sinatra sticks to the protocol.

In this section, we will implement the same functionality in Frankie, using cookie-based session management as provided by `Rack::Session::Cookie` as an example for a commonly used piece of middleware we can simply take off the shelf. As we will see, the presence of middleware will necessitate a more sophisticated way of handling the division of labour between class and instance that we first talked about in [part 01][3] of this series.

> `Rack::Session::Cookie`  is also the default session management solution used by Sinatra. However, Sinatra goes one step further and makes sessions a setting, so beside `use Rack:Session::Cookies`, you can also simply do `enable :sessions`.
{: .aside}

First, let’s look at how to set up the middleware chain. The entry point to the middleware chain is stored in an instance variable `@prototype` (the choice of name will become clear in a minute). Setting up the `@protoype` object makes use of the middleware-handling capabilities already provided by Rack:

```ruby
class Application
  class << self
	def prototype
	  @prototype ||= new
    end

    alias new! new

    def new
      instance = new!
      build(instance).to_app
    end

    def build(app)
      builder = Rack::Builder.new

      if @middleware
        @middleware.each do |middleware, args|
          builder.use(middleware, *args)
        end
      end

      builder.run app
      builder
    end

    def use(middleware, *args)
      (@middleware ||= []) << [middleware, args]
    end
  end
end
```

The gist is this: every `use` statement in our code adds a middleware node to the `@middleware` array (for this to work, we need to *delegate* `use` statements from `main` to `Frankie::Application`, as described in [part 01][4]). As a `@prototype` object is newly created (making use of the `Rack::Builder` class), all those nodes are „wired up“, with a `Frankie::Application` instance fronting the middleware chain. Note that the `@prototype` object is created only once and stored in the `@prototype` class instance variable. The next time around, `protoype` will return the value of that variable, rather than setting up the middleware chain again.

While this is clearly the right approach, it points to a problem for our earlier way of creating a new instance of `Frankie::Application` on every incoming request. Namely, once the middleware chain is set up as above, a specific instance of `Frankie::Application` will persistently front the middleware chain, i.e., it will survive across requests. After all, it’s stored as part of the middleware configuration in the `prototype` object. The question then is how to reinstate the „one instance per request“ principle in this context.

Sinatra’s, and accordingly, Frankie’s, solution is to use the stored instance as a blueprint which is duplicated with every request (hence the choice of the name „`prototype`“). So we add the following code:

```ruby
class Application
  class << self
    def call(env)
      prototype.call(env)
    end
  end

  def call(env)
    dup.call!(env)
  end

  def call!(env)
    # routing code that used to live in `call` goes here
  end
end
```

As the `Frankie::Application` *class* receives a `call` from the web server, it passes the `call` to the `prototype` object. This results in the middleware nodes being `call`ed in turn, until finally, the `Frankie::Application` instance fronting the chain is `call`ed. At this point, the instance *duplicates itself* and invokes `call!` on the duplicate. The actual route-handling code that used to live in `Frankie::Application#call` is simply moved to `call!`. Overall, this is really elegant, and it’s just how Sinatra does it.  

As promised, setting up middleware is really easy now. For illustration, return to our use case of cookie-based session management. Let’s first add a `session` method for accessing the session object. It simply wraps the session object provided by Rack:

```ruby
module
  class Application
    def session
      @request.session
    end
  end
end
```

Now all we really need to do as a Frankie user is to add the earlier-mentioned use statement to our app:

```ruby
use Rack::Session::Cookie, :key => 'rack.session', :secret => "secret"
```

To verify that our session management works, we send ourselves a message across requests:

```ruby
get '/set_message' do
  session[:message] = "Hello, there."
  "Message has been set."
end

get '/get_message' do
  if session[:message]
	"Your message: " + session.delete(:message)
  else
	"There is no message."
  end
end
```

Use [this file][5] (which provides a snapshot of the state of Frankie after these four posts) to see for yourself, if you like. So now we have a version of Frankie that can handle cookies, as well as other pieces of middleware that may come in handy. Neat!

This completes our small tour of Sinatra functionality rebuilt from scratch. See the box below for pointers to some additional features that I have not discussed in detail. You might also want to check out the Frankie sample app mentioned in [part 01][6], if only to conclude that it really does look like a Sinatra app. You can find all the material in the Frankie repo [on Github][7].

> ### There’s More
> As mentioned earlier, there is more to Frankie than I could cover in this series of posts. Here is a quick overview of what Sinatra-inspired features you will find in the [complete Frankie source][8] beyond what we discussed here:
> - View templates: to better organize your code, separate presentation from application logic with view templates. The bindings of the application instance are passed into the template so that instance variables remain useable. An additional [`Templates` module][9] does the job.
> - Throw/catch: Sinatra makes quite heavy use of the `throw`/`catch` mechanism when handling requests. This is what makes Sinatra’s `halt` possible, praised in [this post][10]. To see how this is implemented in Frankie, start at the  `invoke { dispatch! }` method call [here][11].
> - Flexible return values: Frankie allows return values of route blocks to be strings (that end up as the response body), numbers (status codes) or Rack-compliant arrays. The code that allows for this flexibility is [part of the `invoke` method][12].
> - Launching your application: the way Sinatra is set up, you simply `require 'sinatra'` at the top of an `app.rb` file, write your routes, and launch the app with `ruby app.rb` (at least if you code in the so-called „classical style“). To make this possible, Sinatra uses the [`at_exit` trick][13], and so does Frankie.
{: .aside}

[1]:	/2018/06/01/sinatra-from-scratch/
[2]:	/2018/06/03/frankie-sees-a-pattern/
[3]:	/2018/06/01/sinatra-from-scratch/
[4]:	/2018/06/01/sinatra-from-scratch/
[5]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/04_frankie_likes_cookies/frankie.rb
[6]:	http://localhost:4000/2018/06/01/sinatra-from-scratch/
[7]:	https://github.com/benrodenhaeuser/frankie
[8]:	https://github.com/benrodenhaeuser/frankie/blob/master/frankie.rb
[9]:	https://github.com/benrodenhaeuser/frankie/blob/459a2a2997b8fd96d2af5617665eed53cbe7a4a6/frankie.rb#L4
[10]:	http://myronmars.to/n/dev-blog/2012/01/why-sinatras-halt-is-awesome
[11]:	https://github.com/benrodenhaeuser/frankie/blob/459a2a2997b8fd96d2af5617665eed53cbe7a4a6/frankie.rb#L114
[12]:	https://github.com/benrodenhaeuser/frankie/blob/459a2a2997b8fd96d2af5617665eed53cbe7a4a6/frankie.rb#L139
[13]:	https://blog.arkency.com/2013/06/are-we-abusing-at-exit/
