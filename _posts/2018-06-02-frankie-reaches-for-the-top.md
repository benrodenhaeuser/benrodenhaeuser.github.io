---
title: "Frankie Reaches for the Top"
description: 'The top-level DSL: part 02 of the "Sinatra From Scratch" series.'
date: 2018-06-02
---

> This is part 02 in a four part series of blog posts that starts [here][1].
{: .aside}

In [part 01][2] of this series, we reproduced the basic division of labour between class and instance that is a core aspect of Sinatra, and set up mechanisms for route storage and request handling that implement this division of labour. Next, we turn to some aspects of the top-level DSL for which Sinatra is often praised.

To get a Sinatra application going, all you really need to do is `require 'sinatra'` at the top of your file, and go forth writing routes like the following:

```ruby
get '/ditty' do
  status 301
  'Moved permanently.'
end
```

While it’s obvious for a Rubyist that what we see here is actually a method invocation, the code may still quite mysterious. First, the `get` method is available at the top level of our program. How so? Second, the `status` method – which sets the status code of our HTTP response – is in scope within the route block. Why is that? You may remember methods with these names from the previous part of this series. Still, the question remains why they would be available here in the `main` scope.

The answers to the two questions go something like this: As for (1), Sinatra *delegates* certain method calls – like `get` invocations, for instance – from the top level to the `Application` class. And as for (2), the block that is passed with the `get` invocation will eventually be evaluated *in the context of the instance* handling the request, rather than in the context provided by top-level `main`.

Let's  see how to implement this in Frankie, our toy version of Sinatra. First, to be able to delegate top level method calls, we add a `Delegator` module to `Frankie`:

```ruby
module Frankie
  module Delegator
    def self.delegate(method_name)
      define_method(method_name) do |*args, &block|
        Application.send(method_name, *args, &block)
      end
    end

    delegate(:get)
    delegate(:post)
  end
end

extend Frankie::Delegator
```

As a result of this code, any `get` and `post` invocations received by `main` will be passed on  to the `Application` object. Take note that the last line of the snippet lives at the top level. Also, it reads `extend` rather than `include`. If we had used `include` instead, the newly defined methods would be added to `Object`. But `extend` merely attaches them to `main`. Overall, this code takes care of our first issue: we can now freely invoke `get` (and `post`) from the top level, without having to prefix our route handlers with `Frankie::Application`.

Now what about method invocations *within* the route block, our second point above? The answer is, again, meta-programming, and more in particular: `instance_eval`. The [documentation for this method][3] (which belongs to `BasicObject` and is thus available to any Ruby object) tells us that `instance_eval` "evaluates (…) the given block (…) within the context of the receiver." Now this is of course precisely what we need, since we want our route block to be evaluated in the context of the instance handling the current request.

> While early versions of Sinatra made use of `instance_eval` in the way described in this post, later versions (including the current one) employ a different and slightly more involved mechanism for the same purpose. It involves generating method objects from given route blocks that are dynamically bound to the current instance as a request is processed. One advantage of this is that route blocks with parameters become possible. For details, consult [the Sinatra source][4].
{: .aside}

To put `instance_eval` to use, all we really need to change is one line of code – the last line of our `route!` method:

```ruby
module Frankie
  class Application
	def route!
	  match = Application.routes
	                     .select { |r| r[:verb] == @verb }
	                     .find   { |r| r[:path] == @path }
	  return status(404) unless match

	  body instance_eval(&match[:block])
	end
  end
end
```

Recall that `match[:block]` is a Proc object. We convert this object to a block `&match[:block]`, and pass it into `instance_eval`. Since the receiver of the `instance_eval` message is our `Frankie::Application` instance, this instance provides the context in which the block is evaluated. So in particular, all the instance methods of `Frankie::Application` are available to the block at evaluation time.

Summing up, two main ingredients enable top-level route controlers: delegated method calls, and route blocks that are scoped to the current application instance as a request is handled. Run [this file][5] (our code so far), head to `localhost:8080/ditty`, and you will see that our sample request from above works: we get back a 301, indicating that the requested resource has been moved.

Fair enough. Let’s move on [to the next part of the series][6], where we talk about route parameters.

[1]:	/2018/06/01/sinatra-from-scratch/
[2]:	/2018/06/01/sinatra-from-scratch/
[3]:	http://ruby-doc.org/core-2.4.1/BasicObject.html#method-i-instance_eval
[4]:	https://github.com/sinatra/sinatra/blob/a1e36db87e9d6bc3a2d8721078da18e704ee8ba3/lib/sinatra/base.rb#L1614
[5]:	https://github.com/benrodenhaeuser/frankie/blob/master/iterations/02_frankie_reaches_for_the_top/frankie.rb
[6]:	/2018/06/03/frankie-sees-a-pattern/
