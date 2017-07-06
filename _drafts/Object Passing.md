# Object Passing in Ruby

The following is a description of the object passing strategy followed by Ruby.

## Pass-by-reference vs pass-by-value

The following characterizations come from [this article](http://javadude.com/articles/passbyvalue.htm) and are quoted verbatim.

- *Pass-by-value:* "The actual parameter (or argument expression) is fully evaluated and the resulting value is *copied* into a location being used to hold the formal parameter's value during method/function execution. That location is typically a chunk of memory on the runtime stack for the application (which is how Java handles it), but other languages could choose parameter storage differently."
- *Pass-by-reference:* "The formal parameter merely acts as an *alias* for the actual parameter. Anytime the method/function uses the formal parameter (for reading or writing), it is actually using the actual parameter."

Why is the latter called "pass-by-reference"?

> In programming language design (...) a "reference" is an alias to another variable. Any manipulation done to the reference variable directly changes the original variable.

What is the consequence of this? If `a` acts as an alias for `b` in the above sense, then reassigning `a` will have the effect of reassigning `b`: suppose that `a` points to the integer `5`, and `b` is an alias for `b`. Then setting `b = 7` will make both `a` and `b` point to `7`, because `a` and `b` are one and the same variable.

So we can think of the pass-by-reference strategy as passing the variable directly into the procedure: there is really only one variable, and one value the variable is bound to. Anything that the procedure does that affects either the variable or its value will be visible to the caller.

## An additional distinction

Ruby does not use pass-by-reference. It uses pass-by-value. However, to get a better grip on object passing in Ruby, it is useful to distinguish two varieties of pass-by-value: "pass-value-by-value", and "pass-reference-by-value". This terminology comes from [this article](http://robertheaton.com/2014/07/22/is-ruby-pass-by-reference-or-pass-by-value/), from which the following explanation heavily borrows:

1. *Pass-value-by-value:* In pass-value-by-value, the procedure receives a *copy of the objects* passed to it. There is thus no relationship between either the variables or the objects referenced by the values by the function and the caller. Nothing that happens to one will affect the other.
2. *Pass-reference-by-value:* On the pass-reference-by-value model, a procedure receives a reference to the same object in memory that is used by the caller, i.e., caller and callee *share* the object. However, the variable the procedure uses is *not* merely an alias for the variable used by the caller. The procedure has its own ("fresh") variable, which merely happens to point to the same object as the caller variable. This means that changes made to the *object* made inside the procedure will be visible to the caller. But changes made to the *variable* inside the procedure will not be.

Java and C follow the first model. How does Ruby do it? *Ruby follows the second model.* So the variable passed into a Ruby method is not a "complete alias" for the original variable. It is distinct. But the method variable and the variable used by the caller *share a single value*.

## Examples

Let's see the consequences of this with two examples. First, contrast Ruby with the pass-by-reference model.

```ruby
def reassign(array)
  array = [10]
end

array = [1]
reassign(array)
array #=> [1]
```

In this example, the `reassign` method reassigns the variable it receives to another object. In a pass-by-reference language, this would have the effect of reassigning the caller variable `array` as well (because the variable used by the caller and the variable used by the method are *the same*, except for the superficial property of not having the same name). But not so in Ruby: the method uses its own variable, distinct from the variable used by the caller.

So the last line of the above code evaluates to `[1]`, not to `[10]` as we would expect on the pass-by-reference model. *Reassigning a variable within a method will have no effect on the caller in Ruby.*

Let's now contrast Ruby with the pass-value-by-value strategy used by Java and C.

```ruby
def mutate(array)
  array[0] = [10]
end

array = [1]
mutate(array)
array #=> [10]
```

In this example, the `mutate` method mutates the object it receives. In a pass-value-by-value language, this change would not be visible to the caller, since the object used by the method, and the object used by the caller are *distinct*. But not so in Ruby: the object is shared between caller variable and method variable, so the mutation of the array object will be visible to the caller.

As a consequence, the last line of the above code evaluates to `[10]`, not to `[1]` as we would expect on a pass-value-by-value model. *Mutating an object within a method will have an effect on the caller in Ruby.*

### Takeaway

Ruby is not a *pass-by-reference* language, it is a *pass-by-value* language. But it is not a *pass-value-by-value* language, it's *pass-reference-by-value*. Reassignment of a variable within a method will never affect the original variable that lives outside the method. On the other hand, mutating an object within a method will affect the original object outside the method, because those two objects are shared.
