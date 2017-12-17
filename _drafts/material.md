# Material

## Class hierarchy

- The `GenericSet` class defines the basic set data structure. It essentially wraps the hash that we use as a storage container, and provides a basic interface to that storage container:
  - indicator
  - subtract
  - add
  - each

## Getting started

It's high time write some code. Let's start with the bare minimum, and expand the capabilities of our model below. Here is the skeleton of a `Bag` class in Ruby:

As announced, we use a hash, initialized in the constructor method, and referenced by the instance variable `@hash`, as an internal storage device. The intent is that `@hash[elem]` indicates the number of instances of `elem` found in our bag (which could be `0`, in which case `elem` is not to be found in the bag).

Let's initialize a `Bag` object with some elements and see how this works out with what we got so far.

The main step necessary to make this approach amenable to working with sets as well (rather than merely with bags) is to abstract this into a separate method of the `Bag` class that the `Set` class can override. This is the job of the `indicator`.


The intent is that the presence of a particular hash key indicates that the object given by the key is part of the set, and the value for a particular key indicates the count of the object.

For plain sets, this is really all we need to know. For multisets, or bags, as they are also called, their count also matters. The count will be given by the value stored in a hash for a particular key. To see how this works out, lets implement a couple more methods.  

```ruby
enum = [1, 2, 3, 3]
set = Set.new(enum)
bag = Bag.new(enum)

set.each { |elem| puts elem } # output: 1 2 3
bag.each { |elem| puts elem } # output: 1 2 3 3

set.indicator(3) #=> 1
bag.indicator(3) #=> 2
```

One may justifiably wonder why we have chosen to wrap the hash key reference method `Hash#[]` into our own `Bag#indicator` method. While redundant at first sight, this is actually the key abstraction needed to make our initial idea of modeling bags and sets polymorphically. Let's see how.

## Modeling Sets

To model sets, all we need to add is the following code:

```ruby
class Set < Bag
  def indicator(elem)
    super > 0 ? 1 : 0
  end
end
```

This is a a fairly direct implementation of the idea of collapsing the indicator function of a bag to the indicator function of a set.

## More topics

- interfacing with Enumerable: `count`
- operations with enum (union, intersection etc)
- predicates with other set (subset, superset, equality)
- equality and nested sets
- type-checking the value

- applications:
  - multiset: shopping cart, character counter
  - fuzzy set:

- interesting operations on sets:
  - partition
  - powerset

- fuzzy sets: for fuzzy sets, union, intersection and complement still apply.
- however, going from `indicator` to `count` does not make much sense.
- in general, how do we enumerate a fuzzy set?
- what is the subset relation among fuzzy sets?


## Operations

- SUM: for fuzzy sets, this is the "bounded sum" (see here: https://encyclopedia2.thefreedictionary.com/bounded+sum)
- DIFFERENCE: for fuzzy sets, this is called "bounded difference". sometimes, this is also called truncated subtraction (https://en.wikipedia.org/wiki/Monus#Natural_numbers)

## BasicSet class

- purpose : provide and abstract away data structure for working with sets: this class could be replaced by a different one, if we chose to use a different kind of collaborator class (instead of a hash)

## Idea of the class hierarchy:

- BasicSet wraps the hash data structure into a custom interface for sets.
- SetLike

## Basic interface of a set

- :retrieve (key getter) and :update (key setter)
- :insert and :delete key
- :valid_value?

- GenericSet provides :retrieve and :update (and :each)
- GenericSet provides :valid_value? also, but overridden by child classes
- The set child class itself provides :insert and :delete
- SetLike requires :retrieve, :update, and :insert

- NumericMap also provides the storage device (i.e., a hash)

- SetLike provides methods for set-typical operations and predicates (which also includes Enumerable):
  - union
  - intersection
  - difference
  - subset/superset
  - flatten
  - to_s, inspect

## Division of labour between `GenericSet` and `SetLike`

`GenericSet` contains methods that need direct access to instance variables. These methods directly interact with the internal state of our chosen data structure. `SetLike`, on the other hand, only interfaces with the data structure *through* the methods provided by `GenericSet`. It thus respects the guards that the public interface of `GenericSet` puts in place. This helps to protect the integrity of a set.

As an example for such a guard, we provide two methods for manipulating the values associated with the keys in our sets: `insert` and `remove`. Both methods have the side effect of updating the `size` attribute of our set stored in the `@size` instance variable. We thus would not want other methods to bypass `insert` and `remove`, thus frustrating our attempt to maintain the invariant `self.size == self.values.sum` (i.e., mutating the set does not change the fact that the size of the set is be the sum of the values associated with each key).

## Why subclass from `GenericSet`

To enforce a kind of typing via `valid_value?`. E.g., the union of a multiset with a fuzzy set is not necessarily a multiset. (or is it? maybe it is)
