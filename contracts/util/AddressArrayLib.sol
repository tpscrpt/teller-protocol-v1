pragma solidity 0.5.17;

/**
    @notice Utility library of inline functions on the address arrays.

    @author develop@teller.finance
 */
library AddressArrayLib {
    /**
      @notice It adds an address value to the array.
      @param self current array.
      @param newItem new item to add.
      @return the current array with the new item.
    */
    function add(address[] storage self, address newItem)
        internal
        returns (address[] memory)
    {
        require(newItem != address(0x0), "EMPTY_ADDRESS_NOT_ALLOWED");
        self.push(newItem);
        return self;
    }

    /**
      @notice It removes the value at the given index in an array.
      @param self the current array.
      @param index remove an item in a specific index.
      @return the current array without the item removed.
    */
    function removeAt(address[] storage self, uint256 index)
        internal
        returns (address[] memory)
    {
        if (index >= self.length) return self;

        if (index == self.length - 1) {
            delete self[self.length - 1];
            self.length--;
            return self;
        }

        address temp = self[self.length - 1];
        self[self.length - 1] = self[index];
        self[index] = temp;

        delete self[self.length - 1];
        self.length--;

        return self;
    }

    /**
      @notice It gets the index for a given item.
      @param self the current array.
      @param item to get the index.
      @return indexAt the current index for a given item.
      @return found true if the item was found. Otherwise it returns false.
    */
    function getIndex(address[] storage self, address item)
        internal
        view
        returns (bool found, uint256 indexAt)
    {
        found = false;
        for (indexAt = 0; indexAt < self.length; indexAt++) {
            found = self[indexAt] == item;
            if (found) {
                return (found, indexAt);
            }
        }
        return (found, indexAt);
    }

    /**
      @notice It removes an address value to the array.
      @param self current array.
      @param item the item to remove.
      @return the current array without the removed item.
    */
    function remove(address[] storage self, address item)
        internal
        returns (address[] memory)
    {
        (bool found, uint256 indexAt) = getIndex(self, item);
        if (!found) return self;

        return removeAt(self, indexAt);
    }
}
