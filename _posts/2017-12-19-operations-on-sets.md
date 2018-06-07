---
title: "Operations on Sets"
description: 'Part 03 of the "Bunch of Sets" series.'
date: 2017-12-19
---

> This is the last part of a three part series that starts [here](/2017/12/17/a-bunch-of-sets/).
{: .aside}

The `SetMap` class discussed in the [previous entry](http://localhost:4000/2017/12/18/the-set-map-class/) essentially serves as a wrapper around our hash table. We have also implemented a mechanism for specifying what constitutes a valid score for a given type of set. And we have provided our three target classes that inherit from `SetMap`. The basics of our model are thus in place.

What remains to be implemented is all the interesting operations on sets! The remaining part of the interface will, however, not interact with the internally used hash table directly, but only through the interface developed so far.

For the purpose of implementing those additional operations, we open a new module `SetLike`, which we include in `SetMap`. Since our target classes `ClassicalSet`, `FuzzySet` and `MultiSet` inherit from `SetMap`, they will also be able to access the functionality provided by `SetLike`.

### Division of Labor

The division of labor we adopt here takes a cue from the place the `Enumerable` module occupies in Ruby's design. `Enumerable` provides a number of useful methods for working with collections to any class that chooses to include it. In doing so, `Enumerable` assumes that the class implements an `each` method, which forms the basis for all the methods `Enumerable` defines. Beyond this, however, `Enumerable` does not (need to) know anything about the class using it. Here, we do something very similar:

- `SetLike` provides most of the functionality commonly associated with sets.
- `SetLike` assumes that any class that uses it implements the instance methods `retrieve`, `insert`, `delete`, `each` and `size`.
- `SetLike` does not make any further assumptions about the internals of the class using it.

In particular, none of the methods in `SetLike` need to know that we are using a hash for internal storage. This draws a distinction between methods that do need to know that we have chosen to represent sets with hash tables (they go in the `SetMap` class), and methods that don't need to know this (they go in the `SetLike` module), and thus encapsulates the internal state of a set in `SetMap`. As long as we keep the public interface of `SetMap` stable, we could just as well reimplement all its methods using a binary search tree instead of a hash for storing a set, say: `SetLike` will not care.

### Operations on sets

We would like to implement the usual operations on sets, like `union`, `intersection`, and `difference`. Since they all follow essentially the same pattern, we focus on just one of them, `union!` (the  destructive version of `union`).

Following the example established by Ruby's [`Set` class](https://github.com/ruby/ruby/blob/trunk/lib/set.rb), we first implement a helper method `SetLike#do_with` that yields to a block:

```ruby
def do_with(other)
  unless other.instance_of?(self.class)
    raise SetError, "#{self.class} instance needed"
  end

  return other.each unless block_given?
  other.each { |key, val| yield([key, val]) }
end
private :do_with
```

This methods takes care of the type-checking for us. We would not, e.g., want to subtract a fuzzy set from a classical set, as the result will not in general be a classical set. The above guard clause ensures that the operations we will define are only carried out for two objects that belong to the same target class. Beyond this, `do_with` simply yields the key-value pairs of the set passed to it as an argument. Using `do_with`, we implement `union!` as follows:

```ruby
def union!(other)
  do_with(other) do |key, _|
    self[key] = [self[key], other[key]].max
  end
  self
end
```

The union of a given set with another one is defined by maximizing scores for given keys across the two sets. This is how the union is usually defined, and it yields the expected results.

```ruby
# SetMap::from_hash(hsh) creates a new set instance and populates it
# with the key-value pairs from the given hash `hsh`

multi_set1 = MultiSet.from_hash(2 => 1, 3 => 2)
multi_set2 = MultiSet.from_hash(2 => 2, 4 => 1)
multi_set1.union!(multi_set2)

multi_set1 == MultiSet.from_hash(2 => 2, 3 => 2, 4 => 1) # true
```

`union!` implements a notion of "combining what is contained in two given sets". There is a similar, yet slightly different notion which is interesting from the perspective of our polymorphic approach: the *sum* of two sets. So let's briefly digress:

```ruby
def sum!(other)
  do_with(other) { |key, val| insert(key, val) }
  self
end
```

Rather than maximizing scores, as `union!` did, `sum!` adds the scores given by the other set to the scores of the receiver. For classical sets, `sum!` and `union!` amount to the very same thing:

```ruby
# SetMap::[](*list) creates a new set instance and turns the
# members of `list` into keys of the new instance.

set1 = ClassicalSet[1, 2, 3]
set2 = ClassicalSet[2, 3, 4]

set3 = ClassicalSet[1, 2, 3]
set4 = ClassicalSet[2, 3, 4]

set1.union!(set2) == set3.sum!(set4) # true
```

This is why Ruby's own `Set` class simply defines `+` (the sum operator) to be an alias of `|` (the union operator). However, for other types of sets, sum and union are not always the same. This is because taking the maximum of two scores is not generally the same as summing up those two scores! For example:

```ruby
set1 = FuzzySet.from_hash(2 => 0.4)
set2 = FuzzySet.from_hash(2 => 0.3)

set3 = FuzzySet.from_hash(2 => 0.4)
set4 = FuzzySet.from_hash(2 => 0.3)

set1.sum!(set2)
set3.union!(set4)

set1 == FuzzySet.from_hash(2 => 0.7) # true
set3 == FuzzySet.from_hash(2 => 0.4) # true
```

Our model captures all of this correctly.

### Set predicates

A classical set `A` is a subset of a classical set of `B` if any element of `A` is also an element of `B`. This can be expressed in terms of keys and their associated scores by saying that the score for any key in `A` is less than or equal to the score for that same key in `B`. This definition also applies to multisets, and fuzzy sets, so that, again, a common implementation is possible. Here is a first stab at the `SetLike#subset?` method:

```ruby
def subset?(other)
  return false unless other.instance_of?(self.class)

  all? do |key, _|
    self[key] <= other[key]
  end
end
alias <= subset?
```

Following the pattern established by the `do_with` method discussed above, however, it makes sense to extract the "key comparison" functionality to a separate `compare_with?` method that takes a block (you may want to check out the [code of the multiset gem](https://github.com/maraigue/multiset/blob/master/lib/multiset.rb)—the gem author does exactly this).

```ruby
def keys
  each.map(&:first)
end

def compare_with?(other)
  return false unless other.instance_of?(self.class)

  (keys | other.keys).all? do |key|
    yield(self[key], other[key])
  end
end
```

According to line 2 above, the keys of a set object are given by the first component of each key-value pair. `SetLike#compare_with?` then iterates over the keys of both `self` and `other`, and yields the corresponding values to the block. This allows us to implement `subset?` as follows:

```ruby
def subset?(other)
  compare_with?(other) do |s, o|
    s <= o
  end
end
alias <= subset?
```

Definitions for the other common set predicates (`proper_subset?`, `superset?` and `proper_superset?`) are similar, so we omit them here.

### Equivalence

When are two sets `A` and `B` the same? Again, there is an answer that works for all three target classes: the two sets should be in a mutual inclusion relation, i.e., `A` should be a subset of `B`, and `B` a subset of `A`. However, invoking `subset?` twice seems slightly redundant, since in the worst case, this amounts to performing every comparison twice. Using the `compare_with?` method defined above, we can more simply write the following code:

```ruby
def equivalent?(other)
  compare_with?(other) do |s, o|
    s == o
  end
end
alias == equivalent?
alias eql? equivalent?
```

Notice that we have aliassed the `equivalent?` method both as `==` and `eql?`. We have already taken the `==` method for granted in some earlier snippets. Now what about `eql?`? This brings us to our final topic for today:

### Nested sets

Unless overridden, the `Object#eql?` method considers two objects to be the same if they are identical (i.e., are stored at the same location in memory). In the current context, overriding `Object#eql?` is critical, because `eql?` is the method that Ruby uses when accessing hash keys. Let's leave the context of our `SetLike` module for a moment, and consider this line of Ruby code:

```ruby
some_hash[some_obj]
```

When executing this line, Ruby will check if there is a key `key` to be found in `some_hash` with the property that `some_obj.eql?(key)`. If so, the value for `key` will be returned.

For our purposes, this process of looking up keys in a hash is crucial because (1) we are using hashes for storing set membership information, and (2) we would like to be able to model *nested* sets, which are sets that have sets among their keys. Consider:

```ruby
# SetMap::[](*list) creates a new set instance and turns the
# members of `list` into keys of the new instance.

set1 = ClassicalSet[1, 2, 3]
set2 = ClassicalSet[1, 2, 3]
set3 = ClassicalSet[set1, 4]
set4 = ClassicalSet[set2, 4]

set3 == set4 #=> ?
```

Now the question is whether `set3` and `set4` are the same set. It seems that the answer should be yes, because, after all, they *contain the same elements*. Assume, however, for a moment that we had not overridden `eql?`. Then `set3` and `set4` do *not* come out the same in the sense of `==` because `set1` and `set2` do not reference the same object, which implies that `set3[set1] == set4[set1]` will return false, for the simple reason that `set1` is not considered a key in the set `other`, since it is not the case that `set2.eql?(set1)`. So overriding `eql?`, like we did above, is indeed critical.

### The `hash` method

As a final aside: For our set comparisons to work, we also need to override the `Object#hash` method so as to ensure that two set objects that are `eql?` have the same return value when `hash` is called on them. This can be achieved, e.g., like this:

```ruby
def hash
  each.map(&:hash).sum
end
```

Here, we simply map each key-value pair (a two-element array) yielded by `each` to its `hash` value and sum up the result, trusting that `Array#hash` is implemented in a meaningful way. And this indeed ensures that `eql?` sets have the same `hash` return value.

### Coda

What has been achieved? As mentioned at the beginning of part 01, the set functionality that we have discussed is either readily available as part of Ruby's Standard Library (for classical sets), or via an easily accesible Ruby gem (for multisets). However, the code presented here presents a *uniform* perspective on classical sets and multisets. While I have written `SetMap` and its child classes as an exercise for myself, I consider this uniformity an advantage over the pre-existing implementation. We have also seen how easily the approach generalizes to further use cases by considering fuzzy sets.

While coming up with a first working implementation of the types of sets discussed here was pretty straightforward, arriving at a way to structure and modularize my code that I found convincing myself required me to go back to the drawing board several times. If you have a chance to [check out my code](https://github.com/benrodenhaeuser/sets), your feedback would be greatly appreciated.
