---
title: "Frankie Likes Cookies"
description: 'Working with Rack middleware: part 04 of the "Understanding Sinatra" series.'
date: 2018-06-04
---

> This is the final part in a four part series of blog posts that starts [here][1].
{: .aside}

The [previous part][2] of this series of blog posts on Sinatra internals dealt with route parameters. This final part turns to Sinatra’s take on Rack middleware.

The concept of Rack middleware grows naturally out of the concept of a Rack application. A Rack application is an object that responds to `call` and returns a three-element array of the appropriate kind (as described above). Nothing prevents a Rack app from sending a `call` message to *another* Rack app, and using the return value of that `call` to determine its own return value. If a number of Rack apps are hooked up in this way, each calling the next, the non-terminal nodes in this configuration are *middleware* (think of the middleware chain as a linked list of Rack apps and you are not far off from the truth).

Sinatra applications are Rack applications, so of course they place nice with Rack middleware. If you have a number of middleware nodes you want to make use of, all you need to do is place corresponding `use` statements close to the top of your Sinatra application file, such as:

```ruby
use MyMiddleware1
use MyMiddleware2
...
```

Sinatra will hook up the nodes in such way that, as a new request comes in, a `MyMiddleware1` instance will be the first node to receive a `call` message, and an instance of `Sinatra::Application` will be the last (the Sinatra app *fronts* the middleware chain), with each but the last node `call`ing the next node in turn. This is simply the way Rack does it, and Sinatra sticks to the protocol. 

In this section, we will implement the same functionality in Frankie, using cookie-based session management as provided by `Rack::Session::Cookie` as an example for a commonly used piece of middleware we simply take off the shelf. As we will see, the presence of middleware will necessitate a more sophisticated way of handling the division of labour between class and instance that we first talked about in [part 01][3] of this series.

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

The gist is this: every `use` statement in our code adds a middleware node to the `@middleware` array. As a `@prototype` object is newly created (making use of the `Rack::Builder` class), all those nodes are „wired up“, with a `Frankie::Application` instance fronting the middleware chain. Note that the `@prototype` object is created only once and stored in the `@prototype` class instance variable. The next time around, `protoype` will return the value of that variable, rather than setting up the middleware chain again. 

This points to a problem for our earlier approach of creating a new instance of `Frankie::Application` on every incoming request. Namely, once the middleware chain is set up as above, a specific instance of `Frankie::Application` will persistently front the middleware chain, i.e., it will survive across requests. After all, it’s stored in the `prototype` object. The question is how to reinstate the „one instance per request“ principle in this context.

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

As the `Frankie::Application` *class* receives the `call` from the web server, it passes the `call` to the `prototype` object. The middleware nodes process the request (encoded in `env`) in turn, until finally, the `Frankie::Application` instance fronting the chain is `call`ed. At this point, the instance *duplicates itself* and invokes `call!` on the duplicate. The actual route-handling code that used to live in `Frankie::Application#call` is simply moved to `call!`.   

As promised, setting up middleware is really easy now. For illustration, return to our use case of cookie-based session management. Let’s add a `session` method for accessing the session object. It simply wraps the session object provided by Rack:

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
use Rack::Session::Cookie
```

(TODO: The Test)

(TODO: Conclusion)

> ### There’s More
> As mentioned earlier, there is more to Frankie than I could cover in this series of posts. Here is a quick overview of what you will find in the Frankie source beyond what we discussed here: 
> - View templates
> - Throw/catch
> - Flexible return values
> - `at_exit`
{: .aside}

[1]:	/2018/06/01/understanding-sinatra/
[2]:	/2018/06/03/frankie-recognizes-patterns/
[3]:	/2018/06/01/understanding-sinatra/