'use client'

import { createContext, useContext, useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from './AuthContext'
import { apiService } from '../services/api'

const CartContext = createContext()

export const useCart = () => {
  return useContext(CartContext)
}

export const CartProvider = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [carts, setCarts] = useState([]); // Array of carts (one per seller)
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [cartLoaded, setCartLoaded] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedAddress, setSelectedAddress] = useState(null);

  // Debug function to manually test cart (for development only)
  const debugCart = async () => {
    if (user) {
      try {
        await apiService.testCart();
      } catch (error) {
        console.error('Backend test error:', error);
      }
    }
  };

  // Load saved addresses for logged-in users
  useEffect(() => {
    if (user) {
      loadSavedAddresses();
    }
  }, [user]);

  const loadSavedAddresses = async () => {
    try {
      // For now, load from localStorage. Later we can add backend API
      const saved = localStorage.getItem(`addresses_${user.id}`);
      if (saved) {
        const addresses = JSON.parse(saved);
        setSavedAddresses(addresses);
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error);
    }
  };

  const saveAddress = async (address) => {
    try {
      const newAddress = {
        ...address,
        id: Date.now().toString(),
        isDefault: savedAddresses.length === 0 // First address becomes default
      };
      
      const updatedAddresses = [...savedAddresses, newAddress];
      setSavedAddresses(updatedAddresses);
      
      // Save to localStorage
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
      
      return newAddress;
    } catch (error) {
      console.error('Error saving address:', error);
      throw error;
    }
  };

  const updateAddress = async (addressId, updatedAddress) => {
    try {
      const updatedAddresses = savedAddresses.map(addr => 
        addr.id === addressId ? { ...addr, ...updatedAddress } : addr
      );
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
    } catch (error) {
      console.error('Error updating address:', error);
      throw error;
    }
  };

  const deleteAddress = async (addressId) => {
    try {
      const updatedAddresses = savedAddresses.filter(addr => addr.id !== addressId);
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
      
      // If deleted address was selected, clear selection
      if (selectedAddress && selectedAddress.id === addressId) {
        setSelectedAddress(null);
      }
    } catch (error) {
      console.error('Error deleting address:', error);
      throw error;
    }
  };

  const setDefaultAddress = async (addressId) => {
    try {
      const updatedAddresses = savedAddresses.map(addr => ({
        ...addr,
        isDefault: addr.id === addressId
      }));
      setSavedAddresses(updatedAddresses);
      localStorage.setItem(`addresses_${user.id}`, JSON.stringify(updatedAddresses));
    } catch (error) {
      console.error('Error setting default address:', error);
      throw error;
    }
  };

  // Test function to manually add an item to cart (for development only)
  const testAddToCart = async () => {
    const testProduct = {
      _id: 'test-product-123',
      name: 'Test Product',
      price: 100,
      description: 'Test product for debugging'
    };
    await addToCart(testProduct, { quantity: 2 });
  };

  // Expose debug function globally for testing (commented out to prevent state update errors)
  // useEffect(() => {
  //   if (typeof window !== 'undefined') {
  //     window.debugCart = debugCart;
  //     window.testAddToCart = testAddToCart;
  //   }
  // }, [user, cart, cartLoaded]);

  // Helper function to transform backend cart data to frontend format
  const transformBackendCarts = (backendData) => {
    console.log('transformBackendCarts: Input data:', backendData);
    
    if (!backendData || !backendData.carts) {
      console.log('transformBackendCarts: No carts in backend data, returning empty array');
      return [];
    }
    
    const transformed = backendData.carts.map(cart => {
      console.log('transformBackendCarts: Processing cart:', cart);
      return {
        id: cart.id,
        seller_id: cart.seller_id,
        seller_name: cart.seller_name,
        items: cart.items.map(item => ({
          id: item.products?.id,
          name: item.products?.name,
          description: item.products?.description,
          price: item.products?.price,
          images: item.products?.images,
          stock: item.products?.stock,
          instant_delivery: item.products?.instant_delivery,
          quantity: item.quantity,
          giftPackaging: item.gift_packaging || false,
          customizations: item.customizations || [],
          cartItemId: item.id
        })),
        total: cart.total,
        itemCount: cart.itemCount
      };
    });
    
    console.log('transformBackendCarts: Transformed output:', transformed);
    return transformed;
  };

  // Fetch cart from backend for logged-in users, localStorage for guests
  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) {
      return;
    }

    // Add a small delay to ensure user is fully loaded
    const timer = setTimeout(() => {
      fetchCart();
    }, 100);

    return () => clearTimeout(timer);
  }, [user, authLoading]);

  const fetchCart = async () => {
    if (user) {
      // Logged-in user: fetch from backend
      try {
        setLoading(true);
        console.log('CartContext: Fetching cart from backend...');
        const backendData = await apiService.getCart();
        console.log('CartContext: Backend data received:', backendData);
        
        // Transform backend carts to frontend format
        const transformedCarts = transformBackendCarts(backendData);
        console.log('CartContext: Transformed carts:', transformedCarts);
        setCarts(transformedCarts);
      } catch (error) {
        console.error('CartContext: Error fetching carts from backend:', error);
        // If backend fails, try to load from localStorage as fallback
        const savedCart = localStorage.getItem('cart');
        if (savedCart) {
          try {
            const parsedCart = JSON.parse(savedCart);
            // Convert single cart to multi-cart format
            setCarts(parsedCart.length > 0 ? [{
              id: 'local',
              seller_id: null,
              seller_name: 'Local Cart',
              items: parsedCart,
              total: 0,
              itemCount: parsedCart.length
            }] : []);
          } catch (e) {
            console.error('CartContext: Error parsing localStorage cart:', e);
            setCarts([]);
          }
        } else {
          setCarts([]);
        }
      } finally {
        setLoading(false);
        setCartLoaded(true);
      }
    } else {
      // Guest user: load from localStorage (single cart for guests)
      const savedCart = localStorage.getItem('cart');
      
      if (savedCart) {
        try {
          const parsedCart = JSON.parse(savedCart);
          // Convert to multi-cart format
          setCarts(parsedCart.length > 0 ? [{
            id: 'guest',
            seller_id: null,
            seller_name: 'Your Cart',
            items: parsedCart,
            total: 0,
            itemCount: parsedCart.length
          }] : []);
        } catch (error) {
          console.error('CartContext: Error parsing localStorage cart:', error);
          setCarts([]);
        }
      } else {
        setCarts([]);
      }
      setCartLoaded(true);
    }
  };

  // Save guest cart to localStorage (only for guests)
  useEffect(() => {
    if (!user && cartLoaded) {
      try {
        // For guests, flatten all cart items into single localStorage array
        const allItems = carts.flatMap(cart => cart.items);
        localStorage.setItem('cart', JSON.stringify(allItems));
      } catch (error) {
        console.error('CartContext: Error saving to localStorage:', error);
      }
    }
  }, [carts, user, cartLoaded]);

  // Add item to cart
  const addToCart = async (product, options = {}) => {
    const { quantity = 1, giftPackaging = false, customizations = [] } = options;
    
    console.log('addToCart: Called with product:', product, 'options:', options);
    console.log('addToCart: User state:', user);
    console.log('addToCart: User logged in?', !!user);
    
    if (user) {
      // Logged-in user: add to backend (backend will handle seller separation)
      try {
        setLoading(true);
        const productId = product.id || product._id
        
        console.log('addToCart: Calling API with productId:', productId);
        await apiService.addItemToCart({
          productId,
          quantity,
          giftPackaging,
          customizations
        });
        
        console.log('addToCart: Item added successfully, fetching updated cart...');
        // Refetch carts from backend to get updated state
        const backendData = await apiService.getCart();
        
        // Transform backend carts to frontend format
        const transformedCarts = transformBackendCarts(backendData);
        const previousCartCount = carts.length;
        const newCartCount = transformedCarts.length;
        
        console.log('addToCart: Previous cart count:', previousCartCount, 'New cart count:', newCartCount);
        setCarts(transformedCarts);
        
        // Show appropriate message
        if (newCartCount > previousCartCount) {
          toast.success(`${product.name} added to Cart ${newCartCount}!\\nYou have multiple carts from different sellers.`, {
            duration: 4000
          });
        } else {
          toast.success(`${product.name} added to cart!`);
        }
        setIsCartOpen(true);
      } catch (error) {
        console.error('CartContext: Error adding to backend cart:', error);
        console.error('CartContext: Error stack:', error.stack);
        toast.error('Failed to add item to cart');
      } finally {
        setLoading(false);
      }
    } else {
      console.log('addToCart: User not logged in or no token, using guest cart');
      // Guest user: add to localStorage (single cart for now)
      setCarts(prevCarts => {
        const productId = product.id || product._id;
        const guestCart = prevCarts[0] || {
          id: 'guest',
          seller_id: null,
          seller_name: 'Your Cart',
          items: [],
          total: 0,
          itemCount: 0
        };
        
        const existingItemIndex = guestCart.items.findIndex(
          item => (item.id || item._id) === productId && 
          JSON.stringify(item.customizations) === JSON.stringify(customizations)
        );
        
        let newItems;
        if (existingItemIndex !== -1) {
          newItems = [...guestCart.items];
          newItems[existingItemIndex].quantity += quantity;
        } else {
          newItems = [...guestCart.items, {
            ...product,
            quantity,
            giftPackaging,
            customizations,
            cartItemId: Date.now() + Math.random()
          }];
        }
        
        return [{
          ...guestCart,
          items: newItems,
          itemCount: newItems.reduce((sum, item) => sum + item.quantity, 0)
        }];
      });
      
      toast.success(`${product.name} added to cart!`);
      setIsCartOpen(true);
    }
  };

  // Remove item from cart
  const removeFromCart = async (cartItemId) => {
    if (user) {
      // Logged-in user: remove from backend
      try {
        setLoading(true);
        
        await apiService.removeItemFromCart(cartItemId);
        
        // Refetch carts from backend
        const backendData = await apiService.getCart();
        
        // Transform backend carts to frontend format
        const transformedCarts = transformBackendCarts(backendData);
        setCarts(transformedCarts);
        toast.error('Item removed from cart');
      } catch (error) {
        console.error('CartContext: Error removing from backend cart:', error);
        toast.error('Failed to remove item');
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: remove from localStorage
      setCarts(prevCarts => {
        const guestCart = prevCarts[0];
        if (!guestCart) return prevCarts;
        
        const newItems = guestCart.items.filter(item => item.cartItemId !== cartItemId);
        toast.error('Item removed from cart');
        
        if (newItems.length === 0) return [];
        
        return [{
          ...guestCart,
          items: newItems,
          itemCount: newItems.reduce((sum, item) => sum + item.quantity, 0)
        }];
      });
    }
  };

  // Update item quantity
  const updateQuantity = async (cartItemId, newQuantity) => {
    if (user) {
      // Logged-in user: update in backend
      try {
        setLoading(true);
        
        await apiService.updateCartItem(cartItemId, { quantity: newQuantity });
        
        // Refetch carts from backend
        const backendData = await apiService.getCart();
        
        // Transform backend carts to frontend format
        const transformedCarts = transformBackendCarts(backendData);
        setCarts(transformedCarts);
      } catch (error) {
        console.error('CartContext: Error updating quantity in backend cart:', error);
        toast.error('Failed to update quantity');
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: update in localStorage
      setCarts(prevCarts => {
        const guestCart = prevCarts[0];
        if (!guestCart) return prevCarts;
        
        const newItems = guestCart.items.map(item =>
          item.cartItemId === cartItemId 
            ? { ...item, quantity: Math.max(1, newQuantity) }
            : item
        );
        
        return [{
          ...guestCart,
          items: newItems,
          itemCount: newItems.reduce((sum, item) => sum + item.quantity, 0)
        }];
      });
    }
  };

  // Clear cart (or specific cart)
  const clearCart = async (cartId = null) => {
    if (user) {
      // Logged-in user: clear backend cart
      try {
        setLoading(true);
        
        await apiService.clearCart();
        setCarts([]);
        toast.success('Cart cleared successfully');
      } catch (error) {
        console.error('CartContext: Error clearing backend cart:', error);
        setCarts([]);
      } finally {
        setLoading(false);
      }
    } else {
      // Guest user: clear localStorage cart
      setCarts([]);
      localStorage.removeItem('cart');
      toast.success('Cart cleared');
    }
  };

  // Calculate totals across all carts
  const allCartItems = carts.flatMap(cart => cart.items || []);
  const totalItems = allCartItems.reduce((sum, item) => sum + (item.quantity || 0), 0);
  const totalPrice = allCartItems.reduce((sum, item) => {
    const itemPrice = (item.price || 0) * (item.quantity || 0);
    const giftPrice = item.giftPackaging ? 20 * (item.quantity || 0) : 0;
    return sum + itemPrice + giftPrice;
  }, 0);

  return (
    <CartContext.Provider
      value={{
        carts, // Array of carts
        cart: allCartItems, // Flattened items for backward compatibility
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isCartOpen,
        setIsCartOpen,
        loading,
        cartLoaded,
        savedAddresses,
        saveAddress,
        updateAddress,
        deleteAddress,
        setDefaultAddress,
        selectedAddress,
        setSelectedAddress
      }}
    >
      {children}
    </CartContext.Provider>
  );
};