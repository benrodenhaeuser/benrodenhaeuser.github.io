# A Bag of Sets

[Pete](https://pdxwolfy.wordpress.com) mentioned Ruby's Set library the other day on the Slack channel, and how it internally uses a hash to store the elements of a set. He also pointed out that hashes can be used for representing multisets (or *bags*, as multisets are also called). This piqued my interest.

More specifically, I thought that it should be possible to have `Set` and `Bag` classes share a lot, even most of the same code, as an exercise in [polymorphism](http://www.stroustrup.com/glossary.html#Gpolymorphism).

After all, bags and sets have pretty much the same interface:

- we can *add* elements to, or *delete* elements from a bag, same as from a set,
- bags can be *subsets*, or *supersets* of one another, just as sets,
- we can take the *union*, *intersection*, or *difference* of two bags, just as we can for two sets.

The main difference between the two lies in how they count, so this should be the only point were we need code that is specific to each type of object. This post is an account of how I implemented this idea.

## Sets and bags

Sets are unordered collections for which element count does not matter. So

- $\lbrace a, b, c\rbrace$ and $\lbrace a, c, b\rbrace$ represent the same set (since order does not matter),
- $\lbrace a, b, c\rbrace$ and $\lbrace a, b, c, c\rbrace$ represent the same set (since element count does not matter).

<!-- A first smal digression is in order here. Notice that the preceding examples suggest that $\lbrace a, b, c, c\rbrace$ is a perfectly legal set, which is, however, set-theoretically equivalent to the more canonical representation $\lbrace a, b, c\rbrace$. This is not the only perspective one can take on the matter. There is another view according to which "the same element shall not be allowed to appear more than once" in a set. According to that view, $\lbrace a, b, c, c\rbrace$ would not even be a set! However, for our purposes, it is more natural to take the liberal stance of allowing sets with repeated occurences of elements like $\lbrace a, c, b\rbrace$ while identifying them $\lbrace a, c, b\rbrace$. One reason why this is more natural is that it is pretty much how our implementation of sets will turn out to work. -->

For bags, on the other hand, element count does matter. That is,

- $\lbrace a, b, c\rbrace$ and $\lbrace a, c, b\rbrace$ represent the same bag, since order (still) does not matter,
- but $\lbrace a, b, c\rbrace$ and $\lbrace a, b, c, c\rbrace$ *do not* represent the same bag.

The number of times an element occurs in a bag is called the *multiplicity* of that element, and the size of the bag is the sum of the multiplicity of its elements.

## Characteristic functions and multiplicity functions

Sets whose elements are drawn from a given domain (i.e., another set) can be represented by what is called a *characteristic function*, which specifies for each element of the domain whether it is an element of the set in question.  

Suppose that our domain is the characters in the Roman alphabet. Then we can represent the set $\lbrace a, b, c\rbrace$ by means of the function that maps the characters $a$, $b$ and $c$ to $1$ (indicating that they are elements of the set), while mapping all other characters to $0$ (indicating that they are not elements of the set). So sets can be defined as maps from a given universe of objects to the set $\lbrace 0, 1\rbrace$.

This approach can be generalized to bags. Instead of mapping elements to either one of $0$ or $1$, we map them to their element count in the bag. This means that the bag $\lbrace a, b, c, c\rbrace$ would be defined by the function that maps $a$ and $b$ to $1$, $c$ to $2$, and all other characters in the Roman alphabet to $0$.

Such a function is called a multiplicity function.

This perspective on the matter is useful for our purposes for two reasons. First, a characteristic function (be it for a set or a bag) can be neatly captured by a hash table, which is just what we are after. Second, viewing sets and bags through the lens of characteristic functions paves the way towards implementing operations on both types of objects in a uniform way.

As an example, consider the union operation. For two sets given by their characteristic function.


## Setting up the Bag and Set classes

Let's start with the basic setup of our `Bag` and `Set` classes. We will expand the capabilities of both classes as we go along.

```ruby
class Bag
  include Enumerable

  def initialize(enum = [])
    @hash = Hash.new(0)
    merge(enum)
  end

  def indicator(elem)
    @hash[elem]
  end

  def count(elem = nil)
    elem ? indicator(elem) : size
  end

  def each
    return to_enum(&:each) unless block_given?
    @hash.each_key { |elem| count(elem).times { yield(elem) } }
  end
end

class Set < Bag
  def indicator(elem)
    @hash[elem] > 0 ? 1 : 0
  end
end
```

As announced, we use a hash, referenced by the instance variable `@hash`, as an internal storage device for `Bag` objects. The intent is that `@hash[elem] == 0` indicates that a given `elem` is *not* a member of our collection, while `@hash[elem] > 0` indicates that `elem` *is* a member of our collection.  


 The intent is that the presence of a particular hash key indicates that the object given by the key is part of the set, and the value for a particular key indicates the count of the object.

For plain sets, this is really all we need to know. For multisets, or bags, as they are also called, their count also matters. The count will be given by the value stored in a hash for a particular key. To see how this works out, lets implement a couple more methods.  

```ruby
enum = [1, 2, 3, 3]
set = Set.new(enum)
bag = Bag.new(enum)

set.each { |elem| puts elem } # output: 1 2 3
bag.each { |elem| puts elem } # output: 1 2 3 3

set.count(3) #=> 1
bag.count(3) #=> 2
```




## Topics for discussion

- definition of `count` in terms of `indicator`
- illustrate the consequences: `each`
- set interface: like multiset, but don't care about values in internal hash –
  override `count` method
- interface difference: each: yield without repetitions
- use of eql? and hash methods
- set equality can be defined in terms of subset relation


Maybe build both classes (bag and set) as we go?

... For recapitulation, this is the code we have so far:
